package com.android.aviapay.transmanager.device.pinpad;

import com.android.aviapay.appmanager.log.Logger;
import com.android.aviapay.lib.utils.ISOUtil;
import com.android.aviapay.lib.utils.StringUtil;
import com.android.aviapay.transmanager.global.GlobalCfg;
import com.android.aviapay.transmanager.trans.Tcode;
import com.pos.device.SDKException;
import com.pos.device.icc.SlotType;
import com.pos.device.ped.IccOfflinePinApdu;
import com.pos.device.ped.KeySystem;
import com.pos.device.ped.MACMode;
import com.pos.device.ped.Ped;
import com.pos.device.ped.PedRetCode;
import com.pos.device.ped.PinBlockCallback;
import com.pos.device.ped.PinBlockFormat;
import com.pos.device.ped.RsaPinKey;
import com.secure.api.PadView;

import java.text.DecimalFormat;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Created by zhouqiang on 2017/3/14.
 */

public class PinpadManager {
    private static PinpadManager instance ;

    private PinpadManager(){}

    public static PinpadManager getInstance(){
        if(instance == null){
            instance = new PinpadManager();
        }
        return instance ;
    }

    /**
     * 注入主密钥
     * @param info
     * @return
     */
    public static int loadMKey(MasterKeyinfo info){
        return Ped.getInstance().injectKey(info.getKeySystem(),
                info.getKeyType(),info.getMasterIndex(),info.getPlainKeyData());
    }

    /**
     * 注入工作密钥
     * @param info
     * @return
     */
    public static int loadWKey(WorkKeyinfo info){
        return Ped.getInstance().writeKey(info.getKeySystem(),
                info.getKeyType(), info.getMasterKeyIndex(),
                info.getWorkKeyIndex(), info.getMode(),
                info.getPrivacyKeyData());
    }

    private PinpadListener listener ;
    private String pinCardNo ;
    private int timeout ;
    /**
     * get pin status.
     */
    private AtomicBoolean status = new AtomicBoolean(false);

    /**
     * wait the time get offline pin.
     */
    private final static int TIME_OUT = 70;//Second
    private int mErrorCode;
    private Object offlinePinLock = new Object();
    /**
     * 获取联机PIN
     * @param t
     * @param c
     * @param l
     */
    public void getPin(int t, String amount , String c , PinpadListener l){
        this.listener = l ;
        this.timeout = t ;
        this.pinCardNo = c ;
        //TODO
        //处理PED次数调用
        final PinInfo info = new PinInfo();
        if(null == l){
            info.setResultFlag(false);
            info.setErrno(Tcode.T_invoke_para_err);
            listener.callback(info);
        }else if(pinCardNo == null || pinCardNo.equals("")){
            info.setResultFlag(false);
            info.setErrno(Tcode.T_ped_card_err);
            listener.callback(info);
        }else {
            Logger.debug("PinpadManager>>getPin>>");
            final Ped ped = Ped.getInstance() ;
            //ped.setPinInputRegion(40, 242, 2, 2);
            pinCardNo = pinCardNo.substring(pinCardNo.length() - 13, pinCardNo.length() - 1);
            pinCardNo = ISOUtil.padleft(pinCardNo, pinCardNo.length() + 4, '0');
            PadView padView = new PadView();

            padView.setTitleMsg("SECURITY KEYBOARD");
            padView.setAmountTitle("AMOUNT:");
            padView.setAmount(StringUtil.TwoWei(amount));
            padView.setPinTips("INPUT PIN:");
            ped.setPinPadView(padView);
            new Thread(){
                @Override
                public void run() {
                    ped.getPinBlock(KeySystem.MS_DES,
                            GlobalCfg.getInstance().getMasterKeyIndex(),
                            PinBlockFormat.PIN_BLOCK_FORMAT_0,
                            "0,4,5,6,7,8,9,10,11,12",
                            pinCardNo,
                            new PinBlockCallback() {
                                @Override
                                public void onPinBlock(int i, byte[] bytes) {
                                    switch (i){
                                        case PedRetCode.NO_PIN :
                                            info.setResultFlag(true);
                                            info.setNoPin(true);
                                            break;
                                        case PedRetCode.TIMEOUT:
                                            info.setResultFlag(false);
                                            info.setErrno(Tcode.T_wait_timeout);
                                            break;
                                        case PedRetCode.ENTER_CANCEL:
                                            info.setResultFlag(false);
                                            info.setErrno(Tcode.T_user_cancel_pin_err);
                                            break;
                                        case 0:
                                            info.setResultFlag(true);
                                            info.setPinblock(bytes);
                                            break;
                                        default:
                                            info.setResultFlag(false);
                                            info.setErrno(i);
                                            break;
                                    }
                                    listener.callback(info);
                                }
                            });
                }
            }.start();
        }
    }

    /**
     * 获取脱机PIN
     * @param t
     * @param c
     * @param l
     */
    public int getOfflinePin(int tryTime, int keyType, RsaPinKey rsaPinkey, final byte[] len, final byte[] offlinePinBlcok,long amount) {
        Ped ped = Ped.getInstance() ;
        PadView padView = new PadView();
        //    long amount = 10000;
        if (amount >= 0) {
            double amt = (double)amount/(double)100;
            DecimalFormat df = new DecimalFormat("0.00");
            padView.setAmount(df.format(amt));
            padView.setAmountTitle("Amount");
        }
        try {
            ped.setPinEntryTimeout(60);
        } catch (SDKException e) {
            e.printStackTrace();
        }

        if(tryTime == Integer.MAX_VALUE)
            padView.setTitleMsg("Amount");
        else {
            String temp = "NEWPOS KEYBOARD";
            String strTip = String.format(temp, tryTime);
            padView.setTitleMsg(strTip);
        }

        padView.setPinTips("PLEASE ENTER OFFLINE PIN");
        ped.setPinPadView(padView);

        KeySystem ks;
        if (keyType == 1)
            ks = KeySystem.ICC_CIPHER;
        else
            ks = KeySystem.ICC_PLAIN;
        int fd = ped.getIccSlot(SlotType.USER_CARD);
        String pinLenLimit = "0,4,5,6,7,8,9,10,11,12";

        IccOfflinePinApdu apdu = new IccOfflinePinApdu();
        if (keyType == 1) {
            apdu.setRsakey(rsaPinkey);
        }
        apdu.setCla(0x00);
        apdu.setIns(0x20);
        apdu.setLe(0x00);
        apdu.setLeflg(0x00);
        apdu.setP1(0x00);
        apdu.setP2((keyType == 1)?0x88:0x80);

        status.set(false);
        mErrorCode = -1;
        ped.getOfflinePin(ks, fd, pinLenLimit, apdu, new PinBlockCallback() {
            @Override
            public void onPinBlock(int result, byte[] pinBlock) {

                if (result != 0) {
                    mErrorCode = result;
                } else { //成功
                    if (pinBlock != null && len != null && offlinePinBlcok != null) {
                        len[0] = (byte)pinBlock.length;
                        System.arraycopy(pinBlock, 0, offlinePinBlcok, 0, len[0]);
                        mErrorCode = 0;
                    }
                }
                status.set(true);
                releaseLock(offlinePinLock);
            }
        });
        tryLock(offlinePinLock, TIME_OUT);

        return mErrorCode;
    }
    public void getOfflinePin(int t, String amount , String c , PinpadListener l){
        this.listener = l ;
        this.timeout = t ;
        this.pinCardNo = c ;
        //TODO
        //处理PED次数调用
        final PinInfo info = new PinInfo();
        if(null == l){
            info.setResultFlag(false);
            info.setErrno(Tcode.T_invoke_para_err);
            listener.callback(info);
        }else if(pinCardNo == null || pinCardNo.equals("")){
            info.setResultFlag(false);
            info.setErrno(Tcode.T_ped_card_err);
            listener.callback(info);
        }else {
            Logger.debug("PinpadManager>>getPin>>");
            final Ped ped = Ped.getInstance() ;
            //ped.setPinInputRegion(40, 242, 2, 2);
            pinCardNo = pinCardNo.substring(pinCardNo.length() - 13, pinCardNo.length() - 1);
            pinCardNo = ISOUtil.padleft(pinCardNo, pinCardNo.length() + 4, '0');
            PadView padView = new PadView();

            padView.setTitleMsg("KEYBOARD");
            padView.setAmountTitle("AMOUNT:");
            padView.setAmount(StringUtil.TwoWei(amount));
            padView.setPinTips("Please Input PIN / Entry for bypass PIN");
            try {
                ped.setPinEntryTimeout(60);
            } catch (SDKException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }
            ped.setPinPadView(padView);

            //          ped.displayPinEntry("0,4,5,6,7,8,9,10,11,12");
        }
    }

    /**
     * 获取加密后的MAC信息
     * @param data 加密源数据
     * @param offset
     * @param len
     * @return 加密后的MAC信息
     */
    public byte[] getMac(byte[] data, int offset, int len) {
        byte[] macIn ;
        macIn = new byte[((len + 7) >> 3) << 3];
        System.arraycopy(data, offset, macIn, 0, len);
        byte[] macBlock = Ped.getInstance().getMac(KeySystem.MS_DES, GlobalCfg.getInstance().getMasterKeyIndex(), MACMode.MAC_MODE_1, macIn);
        return macBlock;
    }

//    /**
//     * 中信银行算MAC采用CBC方式
//     * @param data
//     * @param offset
//     * @param len
//     * @return
//     */
//    public byte[] getCITICMac(byte[] data, int offset, int len) {
//        byte[] macIn ;
//        macIn = new byte[((len + 7) >> 3) << 3];
//        System.arraycopy(data, offset, macIn, 0, len);
//        byte[] macBlock = Ped.getInstance().getMac(KeySystem.MS_DES, GlobalCfg.getInstance().getMasterKeyIndex(), MACMode.MAC_MODE_CUP, macIn);
//        return macBlock;
//    }

    /**
     * 获取加密后的磁道信息
     * 磁道加密
     * @param track
     * @return
     */
    public String getEac(int index , String track) {
        int ofs, org_len;
        StringBuffer trackEnc = new StringBuffer(120);
        byte[] bufSrc ;
        byte[] bufDest ;
        if (track == null || track.equals(""))
            return null;
        org_len = track.length();//37
        if (((org_len % 2) != 0)) {
            if (track.length() < 17)
                return null;
            ofs = org_len - 17;
        } else {
            if (track.length() < 18)
                return null;
            ofs = org_len - 18;
        }
        trackEnc.append(track.substring(0, ofs));
        bufSrc = ISOUtil.str2bcd(track.substring(ofs, ofs + 16), false);
        bufDest = Ped.getInstance().encryptAccount(KeySystem.MS_DES, index, Ped.TDEA_MODE_ECB, bufSrc);
        if ( bufDest == null ) {
            return null;
        }
        trackEnc.append(ISOUtil.byte2hex(bufDest));
        trackEnc.append(track.substring(ofs + 16, org_len));
        return trackEnc.toString();
    }

    /**
     * release lock
     * @param lock
     */
    private void releaseLock(Object lock) {
        if(lock != null) {
            synchronized (lock) {
                lock.notify();
            }
        }
    }
    private void tryLock(Object lock, int timeOut) {
        if(lock != null) {
            try {
                synchronized (lock) {
                    lock.wait(timeOut * 1000);
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}

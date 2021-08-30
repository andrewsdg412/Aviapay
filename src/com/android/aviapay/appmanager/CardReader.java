package com.android.aviapay.appmanager;

import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.android.aviapay.appmanager.log.Logger;
import com.android.aviapay.lib.utils.AssetsUtil;
import com.android.aviapay.lib.utils.ISOUtil;
import com.android.aviapay.lib.utils.StringUtil;
import com.android.aviapay.transmanager.device.card.CardInfo;
import com.android.aviapay.transmanager.device.card.CardListener;
import com.android.aviapay.transmanager.device.card.CardManager;
import com.android.aviapay.transmanager.device.pinpad.PinInfo;
import com.android.aviapay.transmanager.device.pinpad.PinpadListener;
import com.android.aviapay.transmanager.device.pinpad.PinpadManager;
import com.android.aviapay.transmanager.global.GlobalCfg;
import com.android.aviapay.transmanager.paras.EmvAidInfo;
import com.android.aviapay.transmanager.paras.EmvCapkInfo;
import com.android.aviapay.transmanager.process.EmvTransaction;
import com.android.aviapay.transmanager.process.QpbocTransaction;
import com.android.aviapay.transmanager.trans.Tcode;
import com.android.aviapay.transmanager.trans.Trans;
import com.android.aviapay.transmanager.trans.TransInputPara;
import com.android.aviapay.transmanager.trans.helper.utils.TLVUtil;
import com.android.aviapay.transmanager.trans.manager.DparaTrans;
import com.pos.device.emv.EMVHandler;
import com.pos.device.emv.IEMVHandler;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;



class ReadCardThread implements Runnable {
    private int amount;
    private CardReader cardreader;

    public ReadCardThread(int amount, CardReader cardreader) {
        this.amount = amount;
        this.cardreader = cardreader;
    }

    public void run(){
        cardreader.run_readCard(amount);
    }
}

public class CardReader {
    private Operator mainOperator;
    public int timeout = 60*1000 ;
    private CountDownLatch mLatch ;
    //private int mode = 0;
    private EmvTransaction emv;
    protected QpbocTransaction qpboc ;//QPBOC流程控制实例

    int INMODE_HAND = 0x01;
    int INMODE_MAG = 0x02;
    int INMODE_QR = 0x04;
    int INMODE_IC = 0x08;
    int INMODE_NFC = 0x10;

    int FINAL_INMODE;

    // Remove what we dont need
    protected String MsgID; // 0
    protected String Pan; // 2*
    protected String ProcCode; // 3
    protected long Amount; // 4*
    protected String TraceNo;// 11域交易流水号
    protected String LocalTime; // 12 hhmmss*
    protected String LocalDate; // 13 MMDD*
    protected String ExpDate; // 14 YYMM*
    protected String SettleDate; // 15 MMDD*
    protected String EntryMode; // 22*
    protected String PanSeqNo; // 23*
    protected String SvrCode; // 25
    protected String CaptureCode; // 26
    protected String AcquirerID; // 32*
    protected String Track1;
    protected String Track2; // 35
    protected String Track3; // 36
    protected String RRN; // 37*
    protected String AuthCode; // 38*
    protected String RspCode; // 39 正常交易不存冲正具体设置
    protected String TermID; // 41
    protected String MerchID; // 42
    protected String Field44; // 44 *
    protected String Field48; // 48 *
    protected String CurrencyCode; // 49*
    protected String PIN; // 52
    protected String SecurityInfo; // 53
    protected String ExtAmount; // 54
    protected byte[] ICCData; // 55*
    protected String Field60; // 60
    protected String Field61; // 61
    protected String Field62; // 62
    protected String Field63; // 63
    protected String TransCName; // 交易中文名
    protected String TransEName; // 交易英文名 主键 交易初始化设置
    protected String BatchNo;// 批次号 60_2
    protected boolean isTraceNoInc = false; // 流水号是否自增
    protected boolean isFallBack; // 是否允许IC卡降级为磁卡
    protected boolean isUseOrgVal = false; // 使用原交易的第3域和 60.1域
    protected boolean isPinExist = false;
    private static final String ERRNO_STATUS_PROP = "status/err.properties" ;

    public static final int ENTRY_MODE_MAG = 2; // 刷卡
    public static final int ENTRY_MODE_ICC = 5; // IC卡
    public static final int ENTRY_MODE_NFC = 7; // NFC

    private List<byte[]> capkQueryList;
    private List<byte[]> aidQueryList;
    private EmvAidInfo emvAidInfo;
    private EmvCapkInfo emvCapkInfo;

    private WebView mWebView;

    public TransInputPara para = new TransInputPara();

    private Thread read_card_thread;
    private CardManager cardmanager;
    private int offlinePinError; // store an errNo from the offline pin function.

    public CardReader(Operator mainOperator, WebView mWebView) {
        this.mWebView = mWebView;
        this.mainOperator = mainOperator;
        this.FINAL_INMODE = 0x0;


        para.setTransType(Trans.Type.SALE);
        para.setAmount(0);
        para.setOtherAmount(0);
        para.setMainActivity(this.mainOperator);


        DparaTrans trans = new DparaTrans(this.mainOperator, para.getTransType(), para);
        trans.DownloadAidTest();
        trans.DownloadCapkTest();
        offlinePinError = 0;


    }

    private String getErrnoInfo(String id){
        Logger.debug("errno = "+id);
        String[] pros = AssetsUtil.getProps(this.mainOperator , ERRNO_STATUS_PROP , id);
        if(pros == null){
            return "unknow err["+String.valueOf(id)+"]";
        }else {
            return pros[0] ;
        }
    }

    public PinInfo getPinpadOfflinePin(int timeout, String amount, String cardNo) {
        Logger.debug("Masterctl>>getPinpadOfflinePin");
        this.mLatch = new CountDownLatch(1);
        final PinInfo pinInfo = new PinInfo();
        PinpadManager pinpadManager = PinpadManager.getInstance();
        pinpadManager.getOfflinePin(timeout,amount,cardNo, new PinpadListener() {
            @Override
            public void callback(PinInfo info) {
                pinInfo.setResultFlag(info.isResultFlag());
                pinInfo.setErrno(info.getErrno());
                Log.e("ARRR", "ErrNo" + info.getErrno());
//                mLatch.countDown();
            }
        });
//        try {
//            mLatch.await();
//        } catch (InterruptedException e) {
//            e.printStackTrace();
//        }
        return null ;
    }

    public PinInfo getPinpadOnlinePin(int timeout, String amount, String cardNo) {
        Logger.debug("Masterctl>>getPinpadOnlinePin");
        this.mLatch = new CountDownLatch(1);
        final PinInfo pinInfo = new PinInfo();
        PinpadManager pinpadManager = PinpadManager.getInstance();
        pinpadManager.getPin(timeout,amount,cardNo, new PinpadListener() {
            @Override
            public void callback(PinInfo info) {
                pinInfo.setResultFlag(info.isResultFlag());
                pinInfo.setErrno(info.getErrno());
                pinInfo.setNoPin(info.isNoPin());
                pinInfo.setPinblock(info.getPinblock());
                mLatch.countDown();
            }
        });
        try {
            this.mLatch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return pinInfo ;
    }

    public CardInfo getCardUse(int timeout , int mode) {
        Logger.debug("CardReader>>getCardUse");
        this.mLatch = new CountDownLatch(1) ;
        final CardInfo cInfo = new CardInfo() ;
        cardmanager = CardManager.getInstance(mode);
        cardmanager.getCard(timeout, new CardListener() {
            @Override
            public void callback(CardInfo cardInfo) {
                cInfo.setResultFalg(cardInfo.isResultFalg());
                cInfo.setNfcType(cardInfo.getNfcType());
                cInfo.setCardType(cardInfo.getCardType());
                cInfo.setTrackNo(cardInfo.getTrackNo());
                cInfo.setCardAtr(cardInfo.getCardAtr());
                cInfo.setErrno(cardInfo.getErrno());
                mLatch.countDown();
            }
        });
        try {
            mLatch.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
            this.sendError("Problem waiting for card.");
        }
        return cInfo;
    }

    @JavascriptInterface
    public void enableCardType(boolean mag, boolean icc, boolean nfc) {
        this.FINAL_INMODE = 0x0;
        if (icc) {
            this.FINAL_INMODE |= INMODE_IC;
        } else if (mag) {
            this.FINAL_INMODE |= INMODE_MAG;
        } else if (nfc) {
            this.FINAL_INMODE |= INMODE_NFC;
        }
    }

    @JavascriptInterface
    public void readCard(int amount) {
        if (this.read_card_thread  != null && this.read_card_thread.isAlive()) {
            this.sendError("Still busy processing a card. Please wait and try again.");
            return;
        }

        // Start the read the card process
        Runnable r = new ReadCardThread(amount, this);
        this.read_card_thread = new Thread(r);
        this.read_card_thread.start();
    }

    public void run_readCard(int amount) {
        // set params
        para.setTransType(Trans.Type.SALE);
        para.setAmount(amount);
        para.setOtherAmount(0);
        para.setMainActivity(this.mainOperator);

        //DparaTrans trans = new DparaTrans(this.mainOperator, para.getTransType(), para);
        //trans.DownloadAidTest();
        //trans.DownloadCapkTest();

        int inputmod = FINAL_INMODE;
        int inputMode = 0;
        CardInfo cardInfo = getCardUse(timeout, inputmod);
        if(cardInfo.isResultFalg()){
            int type = cardInfo.getCardType() ;
            switch (type){
                case CardManager.TYPE_MAG :inputMode = ENTRY_MODE_MAG ;break;
                case CardManager.TYPE_ICC :inputMode = ENTRY_MODE_ICC ;break;
                case CardManager.TYPE_NFC :inputMode = ENTRY_MODE_NFC ;break;
            }
            para.setInputMode(inputMode);
            Logger.debug("readCard>>start>>inputMode="+inputMode);
            if(inputMode == ENTRY_MODE_ICC){
                sendProgress("Reading Contact Card ...");
                isICC();
            }else if(inputMode == ENTRY_MODE_NFC) {
                sendProgress("Reading NFC Card ...");
                isNFC();
            }else if(inputMode == ENTRY_MODE_MAG) {
                sendProgress("Reading Magnetic Card ..");
                isMag(cardInfo.getTrackNo());
            }
        } else {
            sendError("Could not read the card provided.");
        }
    }

    @JavascriptInterface
    public void stopReadCard() { // If we are waiting for a card to be read
        Logger.debug("Stopping card reading process.");
        this.cardmanager.releaseAll();
        mLatch.countDown();
    }

    @JavascriptInterface
    public boolean checkCardStillIn() { // Check if the CC is still inserted.
        int inputmod = FINAL_INMODE;
        int inputMode = 0;
        CardInfo cardInfo = getCardUse(500, inputmod);
        if(cardInfo.isResultFalg()) {
            return true;
        } else {
            return false;
        }
    }

    private void sendSuccess(final String cardNum) {
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.initCardPayment('"+ cardNum  + "');";
                mWebView.loadUrl(js);
            }
        });
    }

    private void sendSuccess(final String cardNum, final String expDate, final String cardHolder) {
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.initCardPayment('"+ cardNum  + "', '"+ expDate + "');";
                mWebView.loadUrl(js);
            }
        });
    }

    private void sendProgress(final String message) {
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.cardPaymentProgress('"+ message  + "');";
                mWebView.loadUrl(js);
            }
        });
    }

    public void sendError(final int errCode) {
        sendError(getErrnoInfo(Integer.toString(errCode)));
    }

    private void sendError(final String message) {
        Log.e("ARRR", message);
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.cardPaymentFailed('"+ message  + "');";
                mWebView.loadUrl(js);
            }
        });
    }

    public void tryCountMessage(int attempt_num) {
        this.sendProgress("PIN Failed, " + attempt_num + " PIN attempts remaining");
    }

    private void isMag(String[] tracks){
        Logger.debug("SaleTrans>>T1="+tracks[0]);
        Logger.debug("SaleTrans>>T2="+tracks[1]);
        Logger.debug("SaleTrans>>T3="+tracks[2]);
        String data1 = null;
        String data2 = null;
        String data3 = null;
        int retVal = 0;
        int msgLen = 0;
        if (tracks[0].length() > 0 && tracks[0].length() <= 80) {
            data1 = new String(tracks[0]);
        }
        if (tracks[1].length() >= 13 && tracks[1].length() <= 37) {
            data2 = new String(tracks[1]);
            if(!data2.contains("=")){
                retVal = Tcode.T_search_card_err ;
            }else {
                String judge = data2.substring(0, data2.indexOf('='));
                if(judge.length() < 13 || judge.length() > 19){
                    retVal = Tcode.T_search_card_err ;
                }else {
                    if (data2.indexOf('=') != -1)
                        msgLen++;
                }
            }
        }
        if (tracks[2].length() >= 15 && tracks[2].length() <= 107) {
            data3 = new String(tracks[2]);
        }
        if(retVal!=0){
            this.sendError(retVal);
        }else {
            if (msgLen == 0) {
                this.sendError(Tcode.T_search_card_err);
            }else {
                Log.w("ARRR", data2);
                String expDate = data2.substring(data2.indexOf("=")+ 1, data2.indexOf("=") + 5);
                Log.w("ARRR", expDate);
                String cardHolder = data2.substring(data2.indexOf("=")+ 1, data2.indexOf("=") + 5);
                String cardNo = data2.substring(0, data2.indexOf('='));
                this.sendSuccess(cardNo, expDate, cardHolder);
            }
        }
    }

    private void isNFC(){
//        DparaTrans trans = new DparaTrans(this.mainOperator, "something", para);
//        trans.DownloadAidTest();
//        trans.DownloadCapkTest();

        if(GlobalCfg.isEmvParamLoaded()){

            qpboc = new QpbocTransaction(para);
            Log.w("ARR", "Starting QpbocTransaction");
            int retVal = qpboc.start();
            Logger.debug("QpbocTransaction return = "+retVal);
            if(0 == retVal){
                String cn = qpboc.getCardNO();
                if(cn == null){
                    this.sendError(Tcode.T_qpboc_read_err);
                }else {
                    Pan = cn ;
//                    PinInfo info = getPinpadOnlinePin(timeout, String.valueOf(Amount), cn);
//                    if(info.isResultFlag()) {
//                        afterQpbocGetPin(info);
//                        this.sendSuccess(cn);
//                    } else {
//                        this.sendError("Failed to read NFC card");
//                    }
                    this.sendSuccess(cn);
                }
            }else {
                this.sendError(retVal);
            }
        }else {
            this.sendError(Tcode.T_terminal_no_aid);
        }
    }

    private void afterQpbocGetPin(PinInfo info){
        if(info.isResultFlag()) {
            if(info.isNoPin()){
                isPinExist = false;
            }else {
                isPinExist = true ;
                PIN = ISOUtil.hexString(info.getPinblock()) ;
            }
            IEMVHandler emvHandler = EMVHandler.getInstance();
            byte[] temp =  ISOUtil.str2bcd(Pan , false);
            if(Pan.length()%2 != 0)
                temp[Pan.length() / 2] |= 0x0f;
            emvHandler.setDataElement(new byte[]{0x5A} ,temp );
            Logger.debug("temp = "+ISOUtil.hexString(temp , 0 , temp.length));
            byte[] res = new byte[32] ;
            TLVUtil.get_tlv_data_kernal(0x9F10 , res);
            setICCData();
        } else {
            this.sendError(info.getErrno());
        }
    }

    /** From the kernel to obtain the card number, validity period, 2 tracks, 1 track, card number 55 domain data */
    protected void setICCData(){
        Logger.debug("FinanceTrans>>setICCData>>" +
                "From the kernel to obtain the card number, validity period, 2 tracks, 1 track, card number 55 domain data");
        byte[] temp = new byte[128];
        // card number
        int len = TLVUtil.get_tlv_data_kernal(0x5A, temp);
        Pan = ISOUtil.trimf(ISOUtil.byte2hex(temp, 0, len));
        // 有效期
        len = TLVUtil.get_tlv_data_kernal(0x5F24, temp);
        if(len==3)
            ExpDate = ISOUtil.byte2hex(temp, 0, len - 1);
        // 2磁道
        len = TLVUtil.get_tlv_data_kernal(0x57, temp);
        Track2 = ISOUtil.trimf(ISOUtil.byte2hex(temp, 0, len));
        Logger.debug("get track2 from emvkernel = "+Track2);
        // 1磁道
        len = TLVUtil.get_tlv_data_kernal(0x9F1F, temp);
        Track1 = new String(temp, 0, len);
        // 卡序号
        len = TLVUtil.get_tlv_data_kernal(0x5F34, temp);
        PanSeqNo = ISOUtil.padleft(ISOUtil.byte2int(temp, 0, len) + "", 3, '0');

        // Revoke the transaction disorderly packing 55 domain data
//		if(!para.isVoid()){
        temp = new byte[512];
        len = TLVUtil.pack_tags(Trans.wOnlineTags, temp);
        if (len > 0) {
            ICCData = new byte[len];
            System.arraycopy(temp, 0, ICCData, 0, len);
        } else{
            ICCData = null;
        }
//		}
    }

    public void setOfflinePinError(int x) {
        offlinePinError = x;
    }

    public void isICC(){

//
//        DparaTrans trans = new DparaTrans(this.mainOperator, "something", para);
//        trans.DownloadAidTest();
//        trans.DownloadCapkTest();

        offlinePinError = 0; // Clear errNo codes for later.
        emv = new EmvTransaction(para);

        int retVal = emv.start();
        Logger.debug("Quick_PassTrans>>EmvTransaction=" + retVal);
        Pan = emv.getCardNo() ;

        Log.w("ARRR", "PAN: " + Pan);
        Log.w("ARRR", "TransCName: " + this.TransCName);
        Log.w("ARRR", "TransEName: " + this.TransEName);
        Log.w("ARRR", "track1: " + this.Track1);
        Log.w("ARRR", "track2: " + this.Track2);
        Log.w("ARRR", "field: " + this.Field44);
        Log.w("ARRR", "field: " + this.Field48);
        Log.w("ARRR", "field: " + this.Field60);
        Log.w("ARRR", "field: " + this.Field61);
        Log.w("ARRR", "field: " + this.Field62);
        Log.w("ARRR", "field: " + this.Field63);
        Log.w("ARRR", "field: " + this.RRN);
        Log.w("ARRR", "field: " + this.SecurityInfo);

        Log.w("ARRR", "retVal = " + retVal);


        if (offlinePinError != 0) {
            this.sendError(offlinePinError);
        } else {
            if(retVal == 1 || retVal == 0) {
                setICCData();
                this.sendSuccess(Pan, this.ExpDate, this.TransCName);
            } else {
                this.sendError(getErrnoInfo(Integer.toString(retVal)));
            }
        }
    }

    protected void onDestroy() {
        CardManager.getInstance(0).releaseAll();
        System.gc();
    }
}

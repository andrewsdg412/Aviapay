package com.android.aviapay.appmanager;

import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.android.aviapay.appmanager.log.Logger;
import com.android.aviapay.transmanager.device.barcode.BarcodeInfo;
import com.android.aviapay.transmanager.device.barcode.BarcodeListener;
import com.android.aviapay.transmanager.device.barcode.BarcodeManager;

import java.util.concurrent.CountDownLatch;

/**
 * Created by jacques on 2017/11/15.
 */


class BarcodeScanner {
    private Activity appActivity;
    private CountDownLatch mLatch ;
    private int timeout = 60*1000 ;
    private WebView mWebView;

    public BarcodeScanner(Activity activity, WebView mwebview) {
        this.appActivity = activity;
        this.mWebView = mwebview;
    }

    @JavascriptInterface
    public void startScanner() {
        Log.w("ARR", "Scanner started!!");


        Logger.debug("Masterctl>>getBarcodeUse");
        this.mLatch = new CountDownLatch(1) ;
            /*
            message = mHandler.obtainMessage();
            message.what = MSG_Barcodeuse_RET ;
            message.obj = mode ;
            mHandler.sendMessage(message);
            */
        final BarcodeInfo cInfo = new BarcodeInfo() ;
        final BarcodeManager cardManager = BarcodeManager.getInstance(true);
        try {
            cardManager.getBarcode(timeout, new BarcodeListener() {
                @Override
                public void callback(final BarcodeInfo barcodeInfo) {
                    cInfo.setResult(barcodeInfo.getResult());
                    if(barcodeInfo.getResult() == 0) {
                        cInfo.setCode(barcodeInfo.getCode());
                        cInfo.setType(barcodeInfo.getType());

                        mWebView.post(new Runnable() {
                            @Override
                            public void run() {
                                //webviewLoadURL("file:///android_asset/test1.html");
                                //barcodeInfo.
                                String code = new String(barcodeInfo.getCode());
                                //String code = new String(byteCode);
                                String js = "javascript:ui.loadCode('"+ code  + "');";
                                Log.w("ARRR", js);
                                mWebView.loadUrl(js);
                            }
                        });
                    }
                    Logger.debug("mLatch.countDown reduce");
                    mLatch.countDown();
                }
            });
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        /*
        try {
            Logger.debug("mLatch.await start");
            mLatch.await();
            Logger.debug("mLatch.await over");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }*/
        //return cInfo;


    }

}

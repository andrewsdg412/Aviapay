package com.android.aviapay.appmanager;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import androidx.annotation.RequiresApi;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;

import com.android.aviapay.R;
import com.android.aviapay.appmanager.log.Logger;
import com.android.aviapay.lib.toastview.AppToast;
import com.android.aviapay.lib.utils.ISOUtil;
import com.android.aviapay.lib.utils.StringUtil;
import com.android.aviapay.transmanager.device.card.CardInfo;
import com.android.aviapay.transmanager.device.card.CardListener;
import com.android.aviapay.transmanager.device.card.CardManager;
import com.android.aviapay.transmanager.device.pinpad.PinInfo;
import com.android.aviapay.transmanager.device.pinpad.PinpadListener;
import com.android.aviapay.transmanager.device.pinpad.PinpadManager;
import com.android.aviapay.transmanager.device.printer.PrintManager;
import com.android.aviapay.transmanager.global.GlobalCfg;

import butterknife.Bind;
import butterknife.ButterKnife;
import com.android.aviapay.transmanager.device.barcode.BarcodeInfo;
import com.android.aviapay.transmanager.device.barcode.BarcodeListener;
import com.android.aviapay.transmanager.device.barcode.BarcodeManager;
import com.android.aviapay.transmanager.paras.EmvAidInfo;
import com.android.aviapay.transmanager.paras.EmvCapkInfo;
import com.android.aviapay.transmanager.process.EmvTransaction;
import com.android.aviapay.transmanager.process.QpbocTransaction;
import com.android.aviapay.transmanager.trans.Trans;
import com.android.aviapay.transmanager.trans.TransInputPara;
import com.android.aviapay.transmanager.trans.helper.utils.TLVUtil;
import com.android.aviapay.transmanager.trans.manager.DparaTrans;

import org.apache.commons.lang.StringUtils;

import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;

import static android.content.ContentValues.TAG;

class SlipPrinter {
    private Activity appActivity;
    //private CountDownLatch mLatch ;
    private int timeout = 60*1000 ;
    public SlipPrinter(Activity activity) {
        appActivity = activity;
    }

    @JavascriptInterface
    public void startPrint(String base64img) {
        PrintManager printManager = PrintManager.getmInstance(appActivity);
        printManager.start(base64img);

    }
}



class MiscReader {

    Activity appActivity;
    private String android_id;
    private String versionName;
    private int versionCode;

    public MiscReader(Activity activity) {
        this.appActivity = activity;
        this.android_id = Settings.Secure.getString(activity.getContentResolver(), Settings.Secure.ANDROID_ID);
        try {
            PackageInfo pInfo = appActivity.getPackageManager().getPackageInfo(appActivity.getPackageName(), 0);
            versionName = pInfo.versionName;
            versionCode = pInfo.versionCode;
        } catch (PackageManager.NameNotFoundException e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public String getAndroidId() {
        return this.android_id;
    }

    @JavascriptInterface
    public String getVersionName() {
        return this.versionName;
    }

    @JavascriptInterface
    public int getVersionCode() {
        return this.versionCode;
    }
}

class BatteryLevelReader {
    Operator activity;

    BatteryLevelReader(Operator a) {
        activity = a;
    }

    @JavascriptInterface
    public int getLevel() {
        return activity.battery_percentage;
    }
}

public class Operator extends Activity implements View.OnClickListener {
    public final String MAIN_APP_URL = "file:///android_asset/www/index.html";

    @Bind(R.id.admin_account)
    EditText account ;
    @Bind(R.id.admin_password)
    EditText pass ;
    @Bind(R.id.admin_in_out)
    Button btn ;
    private WebView mWebView;
    String logid = "avialog";

    public CardReader cReader;
    public BarcodeScanner bcScanner;
    public SlipPrinter sPrinter;
    public MiscReader miscReader;
    public Updater updater;
    public BlacklistDatabaseHelper bdh;
    public DataUsageReader dur;
    public int battery_percentage;

    private BroadcastReceiver mBatInfoReceiver = new BroadcastReceiver(){

        @Override
        public void onReceive(Context ctxt, Intent intent) {
            battery_percentage = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, 0);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        setContentView(R.layout.citic_opt);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        mWebView = (WebView) findViewById(R.id.main_webview);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);

        mWebView.setWebViewClient(new WebViewClient() {
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });

        mWebView.loadUrl(MAIN_APP_URL);


        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setDomStorageEnabled(true);

        bcScanner = new BarcodeScanner(Operator.this, mWebView);
        mWebView.addJavascriptInterface(bcScanner, "barcodeScanner");

        sPrinter = new SlipPrinter(Operator.this);
        mWebView.addJavascriptInterface(sPrinter, "slipPrinter");

        cReader = new CardReader(Operator.this, mWebView);
        mWebView.addJavascriptInterface(cReader, "cardReader");

        miscReader = new MiscReader((Operator.this));
        mWebView.addJavascriptInterface(miscReader, "miscReader");

        updater = new Updater(Operator.this, mWebView);
        mWebView.addJavascriptInterface(updater, "updater");

        bdh = BlacklistDatabaseHelper.getInstance(Operator.this);
        mWebView.addJavascriptInterface(bdh, "blacklistStore");

        dur = new DataUsageReader(Operator.this);
        mWebView.addJavascriptInterface(dur, "dataUsageReader");

        // Register batter level tracker.
//        this.registerReceiver(this.mBatInfoReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
//        blr = new BatteryLevelReader(Operator.this);
//        mWebView.addJavascriptInterface(blr, "batteryLevel");

        /*
        if (Build.VERSION.SDK_INT >= 11) {
            //myWebView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            mWebView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);

        } else {
            settings.setRenderPriority(RenderPriority.HIGH);

        }
        */

        ButterKnife.bind(this);
        btn.setOnClickListener(this);
        Citicapp.getInstance().addActivity(this);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Log.w(logid, "Got back from activity....");
        Log.w(logid, String.valueOf(requestCode));
        switch (requestCode) {
            case 2:
                // OCR scanner result
                if (resultCode == -1) { // success
                    Log.w("ARRR", "GOT BACK from intent");
                    if (data != null) {
                        String result = data.getStringExtra("ocr_result");
                        result = result.replaceAll("'", "");
                        result = result.replaceAll("\"", "");

                        String js = "javascript:ui.filterOCRCode('"+ result  + "');";
                        Log.w("ARRR", js);
                        mWebView.loadUrl(js);
                    } else {

                        Log.w("ARRR", "DATA IS null???");
                    }
                    //onOCRPhotoTaken();

                } else {
                    // fail
                }

            default:
                //Log.w(logid, "Should probably never get here..");
        }
    }

    @Override
    public void onClick(View view) {
        String a = account.getText().toString();
        String p = pass.getText().toString();
        if(p.equals("0000")){
            GlobalCfg cfg = GlobalCfg.getInstance();
            cfg.setOprNo(Integer.parseInt(a));
            cfg.save();
            loadSucc();
        }else {
            AppToast.show(this , R.string.operator_pwd_err);
        }
    }

    private void loadSucc(){
        Intent intent = new Intent();
        intent.setClass(this , CiticPay.class);
        startActivity(intent);
        finish();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if(keyCode == KeyEvent.KEYCODE_BACK){
            String js = "javascript:appNav.goBack();";
            Log.w("ARRR", js);
            mWebView.loadUrl(js);
            return false;
            /*
            finish();
            System.gc();
            Citicapp.getInstance().exit();
            */
        }
        return super.onKeyDown(keyCode, event);
    }


    public void closeApp() {
        finish();
        System.gc();
        Citicapp.getInstance().exit();
    }

    public void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

}

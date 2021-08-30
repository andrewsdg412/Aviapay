package com.android.aviapay.appmanager;

import android.content.BroadcastReceiver;
import android.os.Environment;
import android.net.Uri;

import java.io.DataInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;

import android.app.DownloadManager;
import android.app.Activity;
import android.util.Log;
import android.webkit.JavascriptInterface;
import com.android.aviapay.R;
import com.android.aviapay.appmanager.log.Logger;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.webkit.WebView;


class DownloadThread implements Runnable {

    private String url;
    private String destination;
    private WebView mWebView;
    private Activity appActivity;
    private Uri uri;  // URI path to downloaded APK.

    public DownloadThread(Activity appActivity, WebView mWebView, String url, String destination) {
        this.appActivity = appActivity;
        this.mWebView = mWebView;
        this.url = url;
        this.destination = destination;
        this.uri = Uri.parse("file://" + destination);
    }

    public void run(){

        try{
            URL u = new URL(this.url);
            InputStream is=u.openStream();

            DataInputStream dis=new DataInputStream(is);

            int BUF_SIZE = 4096;
            byte[]buffer=new byte[BUF_SIZE];
            int length;
            int total_length=0;

            FileOutputStream fos=new FileOutputStream(new File(destination));
            while((length=dis.read(buffer))>0){
                fos.write(buffer,0,length);
                total_length += length;
                if (total_length % (30 * BUF_SIZE) == 0) {
                    this.updateDownloadProgress(total_length);
                }
            }
            Logger.debug("Total length = " + total_length);
            this.triggerInstall();
        }catch(MalformedURLException mue){
            Log.e("SYNC getUpdate","malformed url error",mue);
        }catch(IOException ioe){
            Log.e("SYNC getUpdate"," io error",ioe);
        }catch(SecurityException se){
            Log.e("SYNC getUpdate"," security error",se);
        }
    }
    private void triggerInstall(){
        Intent promptInstall = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(this.uri,
                        "application/vnd.android.package-archive");
        appActivity.startActivity(promptInstall);
        appActivity.finish();
    }
    private void updateDownloadProgress(final int size) {
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.updateDownloadProgress('"+ size  + "');";
                mWebView.loadUrl(js);
            }
        });
    }
    private void downloadFailed() {
        mWebView.post(new Runnable() {
            @Override
            public void run() {
                String js = "javascript:ui.updateDownloadFailed()";
                mWebView.loadUrl(js);
            }
        });
    }
}


public class Updater {
    private Activity appActivity;
    private Uri uri;  // URI path to downloaded APK.
    private Thread download_thread;
    private WebView mWebView;

    public Updater(Activity activity, WebView mWebView) {
        this.mWebView = mWebView;
        this.appActivity = activity;
    }

    @JavascriptInterface
    public void triggerDownload(String url) {
        // prevent triggering multiple download threads.
        if (this.download_thread  != null && this.download_thread.isAlive()) {
            return;
        }
        String directory = Environment.getExternalStorageDirectory()+"/apks";
        // Make directory if it doesn't exist.
        File direct = new File(directory);
        if(!direct.exists()){
            direct.mkdirs();
        }
        String fileName = "AviaPay.apk";
        String destination = directory + '/' + fileName;
        //Delete update file if exists
        File file=new File(destination);
        if(file.exists()){
            file.delete();
        }
        // Start the download progress.
        Runnable r = new DownloadThread(this.appActivity, this.mWebView, url, destination);
        this.download_thread = new Thread(r);
        this.download_thread.start();
    }

}

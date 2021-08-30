package com.android.aviapay.appmanager;

import android.app.Activity;
import android.content.Context;
import android.net.TrafficStats;
import android.webkit.JavascriptInterface;

public class DataUsageReader {
    private Activity appActivity;

    public DataUsageReader(Activity activity) {
        this.appActivity = activity;

    }

    @JavascriptInterface
    public long getCombinedMobileTotalUsage() {
        long received = TrafficStats.getMobileRxBytes();
        long sent   = TrafficStats.getMobileTxBytes();
        return sent + received;
    }

    @JavascriptInterface
    public long getCombinedTotalUsage() {
        long received = TrafficStats.getTotalRxBytes();
        long sent = TrafficStats.getTotalTxBytes();
        return sent + received;
    }

}

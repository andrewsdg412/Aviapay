package com.android.aviapay.transmanager.trans;

import android.app.Activity;
//import android.test.ActivityInstrumentationTestCase;

import com.android.aviapay.appmanager.Operator;
import com.android.aviapay.transmanager.trans.helper.translog.TransLogData;
import com.android.aviapay.transmanager.trans.presenter.TransUI;

/**
 * Created by zhouqiang on 2017/3/30.
 */

public class TransInputPara {
    private boolean isNeedAmount = false;// Whether the amount is required
    private boolean isNeedPass = false;// Whether a password is required
    private boolean isNeedConfirmCard = false; // Whether you need to confirm the card number
    private long amount ;// Amount of money
    private long otherAmount ; //The second amount
    private boolean isNeedOnline = false;// Whether to force online
    private int inputMode ;// External input mode
    private String transType ;// ransaction Type
    private boolean isVoid = false;// 是否是撤销交易
    private boolean isNeedPrint = false;// 是否需要打印
    private boolean isECTrans = false; // Whether it is an electronic cash transaction
    private TransLogData voidTransData ;// 当前撤销数据
    private TransUI transUI ;// UIP层接口实例
    private Operator mainOperator;

    public boolean isNeedAmount() {
        return isNeedAmount;
    }

    public void setNeedAmount(boolean needAmount) {
        isNeedAmount = needAmount;
    }

    public boolean isNeedPass() {
        return isNeedPass;
    }

    public void setNeedPass(boolean needPass) {
        isNeedPass = needPass;
    }

    public long getAmount() {
        return amount;
    }

    public void setAmount(long amount) {
        this.amount = amount;
    }

    public long getOtherAmount() {
        return otherAmount;
    }

    public void setOtherAmount(long otherAmount) {
        this.otherAmount = otherAmount;
    }

    public boolean isNeedOnline() {
        return isNeedOnline;
    }

    public void setNeedOnline(boolean needOnline) {
        isNeedOnline = needOnline;
    }

    public int getInputMode() {
        return inputMode;
    }

    public void setInputMode(int inputMode) {
        this.inputMode = inputMode;
    }

    public String getTransType() {
        return transType;
    }

    public void setTransType(String transType) {
        this.transType = transType;
    }

    public boolean isVoid() {
        return isVoid;
    }

    public void setVoid(boolean aVoid) {
        isVoid = aVoid;
    }

    public TransLogData getVoidTransData() {
        return voidTransData;
    }

    public void setVoidTransData(TransLogData voidTransData) {
        this.voidTransData = voidTransData;
    }

    public TransUI getTransUI() {
        return transUI;
    }

    public void setTransUI(TransUI transUI) {
        this.transUI = transUI;
    }

    public boolean isNeedConfirmCard() {
        return isNeedConfirmCard;
    }

    public void setNeedConfirmCard(boolean needConfirmCard) {
        isNeedConfirmCard = needConfirmCard;
    }

    public boolean isECTrans() {
        return isECTrans;
    }

    public void setECTrans(boolean ECTrans) {
        isECTrans = ECTrans;
    }

    public boolean isNeedPrint() {
        return isNeedPrint;
    }

    public void setNeedPrint(boolean needPrint) {
        isNeedPrint = needPrint;
    }

    public Operator getMainActivity() {
        return mainOperator;
    }

    public void setMainActivity(Operator mainOperator) {
        this.mainOperator = mainOperator;
    }
}

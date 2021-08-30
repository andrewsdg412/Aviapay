package com.android.aviapay.transmanager.trans.finace.barcode_sale;

import android.content.Context;

import com.android.aviapay.appmanager.log.Logger;
import com.android.aviapay.transmanager.device.input.InputInfo;
import com.android.aviapay.transmanager.trans.Tcode;
import com.android.aviapay.transmanager.trans.TransInputPara;
import com.android.aviapay.transmanager.trans.finace.FinanceTrans;
import com.android.aviapay.transmanager.trans.presenter.TransPresenter;
import com.android.aviapay.transmanager.device.barcode.*;

/**
 * 消费交易，继承自金融类交易
 */

public class BarcodeSaleTrans extends FinanceTrans implements TransPresenter {

	public BarcodeSaleTrans(Context ctx, String transEname , TransInputPara p) {
		super(ctx, transEname);
		para = p ;
		transUI = para.getTransUI() ;
		isReversal = true;
		isSaveLog = true;
		isDebit = true;
		isProcPreTrans = true;
//		isProcSuffix = true;
	}

	@Override
	public void start() {
		//取金额
		Logger.debug("getOutsideAmt");
		int timeout = 60 * 1000 ;
		InputInfo inputInfo = transUI.getOutsideInput(timeout , AMOUNT_INPUT);
		if(inputInfo.isResultFlag()){
			Logger.debug(inputInfo.getResult());
			Amount = Long.parseLong(inputInfo.getResult());
			para.setAmount(Amount);
			para.setOtherAmount(0);

			Logger.debug("getBarcodeUse");
			inputMode = ENTRY_MODE_BARCODE;
			BarcodeInfo barcodeInfo = transUI.getBarcodeUse(timeout,false);
			if(barcodeInfo.getResult() == 0){
				if(retVal == 0){
					retVal = FakeOnlineBarcodeTrans(new String(barcodeInfo.getCode()));
					if(retVal == 0)
						transUI.trannSuccess(Tcode.Status.success);
					else
						transUI.showError(retVal);
				}else {
					transUI.showError(retVal);
				}
			}else {
				Logger.debug("barcodeSaleTrans>>showError");
				transUI.showError(barcodeInfo.getResult());
			}
		}else {
			Logger.debug("barcodeSaleTrans>>get errno");
			transUI.showError(inputInfo.getErrno());
		}

		Logger.debug("barcodeSaleTrans>>finish");
		return;
	}



}

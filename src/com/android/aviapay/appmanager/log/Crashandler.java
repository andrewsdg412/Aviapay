package com.android.aviapay.appmanager.log;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.PackageManager.NameNotFoundException;
import android.os.Build;
import android.os.Looper;
import android.widget.Toast;

import com.android.aviapay.R;
import com.android.aviapay.appmanager.Citicapp;
import com.android.aviapay.transmanager.global.GlobalCfg;
import com.pos.device.SDKException;
import com.pos.device.icc.IccReader;
import com.pos.device.icc.SlotType;
import com.pos.device.magcard.MagCardReader;
import com.pos.device.picc.PiccReader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.Writer;
import java.lang.Thread.UncaughtExceptionHandler;
import java.lang.reflect.Field;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * 捕获程序中未捕获的异常类
 * 当程序发生Uncaught异常的时候,有该类来接管程序,并记录发送错误报告.
 */
public class Crashandler implements UncaughtExceptionHandler {

	//实例对象
	private static Crashandler INSTANCE = new Crashandler();

	// 程序的上下文 Context 对象
	private Context mContext;

	// 系统默认的 UncaughtException 处理类
	private UncaughtExceptionHandler mDefaultHandler;

	// 用来存储设备信息和异常信息
	private Map<String, String> infos = new HashMap<String, String>();

	// 用于格式化日期,作为日志文件名的一部分
	private DateFormat formatter = new SimpleDateFormat("yyyy-MM-dd-HH-mm-ss");

	/** 保证只有一个 Crashandler 实例 */
	private Crashandler() {
	}

	/** 获取 Crashandler 实例 ,单例模式 */
	public static Crashandler getInstance() {
		return INSTANCE;
	}

	/**
	 * 初始化
	 * @param context
	 */
	public void init(Context context) {
		mContext = context;

		// 获取系统默认的 UncaughtException 处理器
		mDefaultHandler = Thread.getDefaultUncaughtExceptionHandler();

		// 设置该 Crashandler 为程序的默认处理器
		Thread.setDefaultUncaughtExceptionHandler(this);
	}

	/**
	 * 当 UncaughtException发生时会转入该函数来处理
	 */
	@Override
	public void uncaughtException(Thread thread, Throwable ex) {
		if (!handleException(ex) && mDefaultHandler != null) {
			// 如果用户没有处理则让系统默认的异常处理器来处理
			mDefaultHandler.uncaughtException(thread, ex);
		} else {
			try {
				Thread.sleep(2000);
			} catch (InterruptedException e) {
				Logger.debug("error : "+e.toString());
			}
			// 退出程序
			android.os.Process.killProcess(android.os.Process.myPid());
			System.exit(1);
			System.gc();
		}
	}

	/**
	 * 自定义错误处理，收集错误信息，发送错误报告等操作均在此完成
	 * @param ex
	 * @return true：如果处理了该异常信息；否则返回 false
	 */
	private boolean handleException(Throwable ex) {
		if (ex == null) {
			return false;
		}

		new Thread() {
			@Override
			public void run() {
				Looper.prepare();
				Toast.makeText(mContext, mContext.getResources().getString(R.string.app_exception), Toast.LENGTH_SHORT).show();
				Looper.loop();
			}
		}.start();

		try {
			Thread.sleep(2000);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}

		// 清楚相关敏感信息

		try {
			IccReader.getInstance(SlotType.USER_CARD).release();
			MagCardReader.getInstance().stopSearchCard();
			PiccReader.getInstance().release();
		} catch (SDKException e) {
			e.printStackTrace();
		}

		// 收集设备参数信息
		collectDeviceInfo(mContext);
		// 保存日志文件
		saveCrashInfo2File(ex);
		//退出程序
		((Citicapp) mContext).exit();
		return true;
	}

	/**
	 * 收集设备参数信息
	 * @param ctx
	 */
	public void collectDeviceInfo(Context ctx) {
		try {
			PackageManager pm = ctx.getPackageManager();
			PackageInfo pi = pm.getPackageInfo(ctx.getPackageName(), PackageManager.GET_ACTIVITIES);

			if (pi != null) {
				String versionName = pi.versionName == null ? "null" : pi.versionName;
				String versionCode = pi.versionCode + "";
				infos.put("versionName", versionName);
				infos.put("versionCode", versionCode);
			}
		} catch (NameNotFoundException e) {
			Logger.debug("an error happened when collect package info:"+ e.toString());
		}

		Field[] fields = Build.class.getDeclaredFields();
		for (Field field : fields) {
			try {
				field.setAccessible(true);
				infos.put(field.getName(), field.get(null).toString());
				Logger.debug("Build.class.getDeclaredFields = "+field.getName() + " : " + field.get(null));
			} catch (Exception e) {
				Logger.debug("an error happened when collect crash info:"+e.toString());
			}
		}
	}

	/**
	 * 保存错误信息到文件中
	 * @param ex
	 * @return 返回文件名称,便于将文件传送到服务器
	 */
	private String saveCrashInfo2File(Throwable ex) {
		StringBuffer sb = new StringBuffer();
		for (Map.Entry<String, String> entry : infos.entrySet()) {
			String key = entry.getKey();
			String value = entry.getValue();
			sb.append(key + "=" + value + "\n");
		}

		Writer writer = new StringWriter();
		PrintWriter printWriter = new PrintWriter(writer);
		ex.printStackTrace(printWriter);
		Throwable cause = ex.getCause();
		while (cause != null) {
			cause.printStackTrace(printWriter);
			cause = cause.getCause();
		}
		printWriter.close();

		String result = writer.toString();
		sb.append(result);
		try {
			String time = formatter.format(new Date());
			String fileName = "err-" + time + ".newpos";
			String path = GlobalCfg.getROOT_FILE_PATH() + "errlog/";
			File dir = new File(path);
			if (!dir.exists()) {
				dir.mkdirs();
			}
			FileOutputStream fos = new FileOutputStream(path + fileName);
			fos.write(sb.toString().getBytes());
			fos.close();

			return fileName;
		} catch (Exception e) {
			Logger.debug("an error happened while writing file:"+ e.toString());
		}
		return null;
	}
}

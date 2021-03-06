
/**
 * Created by zhouqiang on 2017/3/6.
 */

package com.android.aviapay.lib.keysview;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Paint;
import android.text.TextUtils.TruncateAt;
import android.util.AttributeSet;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewTreeObserver.OnGlobalLayoutListener;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.Animation.AnimationListener;
import android.view.animation.AnimationSet;
import android.view.animation.AnimationUtils;
import android.view.animation.Interpolator;
import android.view.animation.ScaleAnimation;
import android.view.animation.TranslateAnimation;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.util.LinkedList;
import java.util.Random;
import java.util.Vector;

public class KeywordView extends FrameLayout implements OnGlobalLayoutListener {

    public static final int IDX_X = 0;
    public static final int IDX_Y = 1;
    public static final int IDX_TXT_LENGTH = 2;
    public static final int IDX_DIS_Y = 3;
    public static final int ANIMATION_IN = 1;
    public static final int ANIMATION_OUT = 2;
    public static final int OUTSIDE_TO_LOCATION = 1;
    public static final int LOCATION_TO_OUTSIDE = 2;
    public static final int CENTER_TO_LOCATION = 3;
    public static final int LOCATION_TO_CENTER = 4;
    public static final long ANIM_DURATION = 800l;
    public static final int MAX = 12;
    public static final int TEXT_SIZE_MAX = 20;
    public static final int TEXT_SIZE_MIN = 16;

    private OnClickListener itemClickListener;
    private static Interpolator interpolator;
    private static AlphaAnimation animAlpha2Opaque;
    private static AlphaAnimation animAlpha2Transparent;
    private static ScaleAnimation animScaleLarge2Normal, animScaleNormal2Large, animScaleZero2Normal,animScaleNormal2Zero;

    private Vector<String> vecKeywords;
    private int width , height;

    private boolean enableShow;
    private Random random;

    private int txtAnimINType, txtAnimOutType;

    private long lastStartAnimationTime;

    private long animDuration ;

    public KeywordView(Context context){
        super(context);
        init();
    }

    public KeywordView(Context context, AttributeSet attrs){
        super(context,attrs);
        init();
    }

    public KeywordView(Context context, AttributeSet attrs, int defStyle) {
        super(context, attrs, defStyle);
        init();
    }

    private void init(){
        lastStartAnimationTime = 0l;
        animDuration = ANIM_DURATION;
        random = new Random();
        vecKeywords = new Vector<String>(MAX);
        getViewTreeObserver().addOnGlobalLayoutListener(this);
        interpolator = AnimationUtils.loadInterpolator(getContext(), android.R.anim.decelerate_interpolator);
        animAlpha2Opaque = new AlphaAnimation(0.0f, 1.0f);
        animAlpha2Transparent = new AlphaAnimation(1.0f, 0.0f);
        animScaleLarge2Normal = new ScaleAnimation(2, 1, 2, 1);
        animScaleNormal2Large = new ScaleAnimation(1, 2, 1, 2);
        animScaleZero2Normal = new ScaleAnimation(0, 1, 0 ,1);
        animScaleNormal2Zero = new ScaleAnimation(1, 0, 1, 0);
    }

    public long getDuration(){
        return animDuration;
    }

    public void setDuration(long duration){
        animDuration = duration;
    }

    public boolean feedKeyword(String keyword){
        boolean result = false;
        if(vecKeywords.size()<MAX){
            result = vecKeywords.add(keyword);
        }
        return result;
    }

    public boolean go2Shwo(int animType){
        if(System.currentTimeMillis() - lastStartAnimationTime > animDuration){
            enableShow = true;
            if(animType == ANIMATION_IN){
                txtAnimINType = OUTSIDE_TO_LOCATION;
                txtAnimOutType = LOCATION_TO_CENTER;
            }else if(animType == ANIMATION_OUT){
                txtAnimINType = CENTER_TO_LOCATION;
                txtAnimOutType = LOCATION_TO_OUTSIDE;
            }
            disapper();
            boolean result = show();
            return result;
        }
        return false;
    }

    private void disapper() {
        int size = getChildCount();
        for (int i = size - 1; i >= 0; i--) {
            final TextView txt = (TextView) getChildAt(i);
            if(txt.getVisibility() == View.GONE){
                removeView(txt);
                continue;
            }
            LayoutParams layParams = (LayoutParams) txt.getLayoutParams();
            int[] xy = new int[]{layParams.leftMargin,layParams.topMargin,txt.getWidth()};
            AnimationSet animSet = getAnimationSet(xy,(width >> 1),(height >> 1),txtAnimOutType);
            txt.startAnimation(animSet);

            animSet.setFillBefore(true);

            animSet.setAnimationListener(new AnimationListener() {

                public void onAnimationStart(Animation animation) {
                }

                public void onAnimationRepeat(Animation animation) {
                }

                public void onAnimationEnd(Animation animation) {
                    txt.setOnClickListener(null);
                    txt.setClickable(true);
                    txt.setVisibility(View.GONE);
                }
            });
        }
    }

    private boolean show() {
        if(width > 0 && height > 0 && vecKeywords != null && vecKeywords.size() > 0 && enableShow){
            enableShow = false;
            lastStartAnimationTime = System.currentTimeMillis();
            int xCenter = width >> 1, yCenter = height >> 1;
            int size = vecKeywords.size();
            int xItem = width / size , yItem = height / size;
            LinkedList<Integer> listX = new LinkedList<Integer>(), listY = new LinkedList<Integer>();
            for (int i = 0; i < size; i++) {
                listX.add(i*xItem);
                listY.add(i*yItem + (yItem >> 2));
            }
            LinkedList<TextView> listTxtTop = new LinkedList<TextView>();
            LinkedList<TextView> listTxtBottom = new LinkedList<TextView>();
            for (int i = 0; i < size; i++) {
                String keyword = vecKeywords.get(i);
                int ranColor =  random.nextInt(4);
                int color = Color.WHITE;
                if(ranColor == 0){
                    color = Color.WHITE;
                }else if(ranColor == 1){
                    color = Color.GREEN;
                }else if(ranColor == 2){
                    color = Color.RED;
                }else if(ranColor == 3){
                    color = Color.BLUE;
                }
                int xy[] =randomXY(random,listX,listY,xItem);
                int txtSize = TEXT_SIZE_MIN ;//+ random.nextInt(TEXT_SIZE_MAX - TEXT_SIZE_MIN + 1);
                final TextView txt = new TextView(getContext());
                txt.setOnClickListener(itemClickListener);
                txt.setText(keyword);
                txt.setTextColor(color);
                txt.setTextSize(TypedValue.COMPLEX_UNIT_SP,txtSize);
                txt.setShadowLayer(2, 2, 2, 0xff696969);
                txt.setGravity(Gravity.CENTER);
                txt.setEllipsize(TruncateAt.MIDDLE);
                txt.setSingleLine(true);
                txt.setEms(10);
                Paint paint = txt.getPaint();
                int strWidth = (int) Math.ceil(paint.measureText(keyword));
                xy[IDX_TXT_LENGTH] = strWidth;
                if(xy[IDX_X] + strWidth > width - (xItem >> 1)){
                    int baseX = width - strWidth;
                    xy[IDX_X] = baseX - xItem + random.nextInt(xItem>>1);
                }else if(xy[IDX_X] == 0){
                    xy[IDX_X] = Math.max(random.nextInt(xItem), xItem / 3);
                }
                xy[IDX_DIS_Y] = Math.abs(xy[IDX_Y] - yCenter);
                txt.setTag(xy);
                if(xy[IDX_Y]> yCenter){
                    listTxtBottom.add(txt);
                }else{
                    listTxtTop.add(txt);
                }
            }
            attch2Screen(listTxtTop,xCenter,yCenter,yItem);
            attch2Screen(listTxtBottom,xCenter,yCenter,xItem);
            return true;
        }
        return false;
    }

    private void attch2Screen(LinkedList<TextView> listTxt, int xCenter,
                              int yCenter, int yItem) {
        int size = listTxt.size();
        sortXYList(listTxt,size);
        for (int i = 0; i < size; i++) {
            TextView txt = listTxt.get(i);
            int[] iXY = (int[]) txt.getTag();
            int yDistance = iXY[IDX_Y] - yCenter;
            int yMove = Math.abs(yDistance);
            inner:for (int k = i - 1; k >= 0; k--) {
                int[] kXY = (int[]) listTxt.get(k).getTag();
                int startX = kXY[IDX_X];
                int endX = startX + kXY[IDX_TXT_LENGTH];
                if(yDistance * (kXY[IDX_Y] - yCenter) > 0){
                    if(isXMixed(startX, endX, iXY[IDX_X], iXY[IDX_X] + iXY[IDX_TXT_LENGTH])){
                        int tmpMove = Math.abs(iXY[IDX_Y] - kXY[IDX_Y]);
                        if(tmpMove > yItem){
                            yMove = tmpMove;
                        }else if(yMove > 0){
                            yMove = 0;
                        }
                        break inner;
                    }
                }
            }
            if(yMove > yItem){
                int maxMove = yMove - yItem;
                int randomMove = random.nextInt(maxMove);
                int realMove = Math.max(randomMove, maxMove >> 1)*yDistance/Math.abs(yDistance);
                iXY[IDX_Y] = iXY[IDX_Y] - realMove;
                iXY[IDX_DIS_Y] = Math.abs(iXY[IDX_Y] - yCenter);
                sortXYList(listTxt, i+1);
            }
            LayoutParams layParams = new LayoutParams(
                    LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
            layParams.gravity = Gravity.LEFT | Gravity.TOP;
            layParams.leftMargin = iXY[IDX_X];
            layParams.topMargin = iXY[IDX_Y];
            addView(txt,layParams);
            AnimationSet animSet = getAnimationSet(iXY, xCenter, yCenter, txtAnimINType);
            txt.startAnimation(animSet);
        }
    }
    private AnimationSet getAnimationSet(int[] xy, int xCenter, int yCenter,
                                         int type) {
        AnimationSet animSet = new AnimationSet(true);
        animSet.setInterpolator(interpolator);
        if(type == OUTSIDE_TO_LOCATION){
            animSet.addAnimation(animAlpha2Opaque);
            animSet.addAnimation(animScaleLarge2Normal);
            TranslateAnimation translate = new TranslateAnimation(
                    (xy[IDX_X] +(xy[IDX_TXT_LENGTH]>>1)-xCenter)<<1, 0, (xy[IDX_Y] -yCenter)<<1, 0);
            animSet.addAnimation(translate);
        }else if (type == LOCATION_TO_OUTSIDE){
            animSet.addAnimation(animAlpha2Transparent);
            animSet.addAnimation(animScaleNormal2Large);
            TranslateAnimation translate = new TranslateAnimation(
                    0, (xy[IDX_X] +(xy[IDX_TXT_LENGTH]>>1)-xCenter)<<1, 0, (xy[IDX_Y] -yCenter)<<1);
            animSet.addAnimation(translate);
        }else if (type == LOCATION_TO_CENTER){
            animSet.addAnimation(animAlpha2Transparent);
            animSet.addAnimation(animScaleNormal2Zero);
            TranslateAnimation translate = new TranslateAnimation(
                    0, xCenter - xy[IDX_X], 0, yCenter - xy[IDX_Y]);
            animSet.addAnimation(translate);
        }else if (type == CENTER_TO_LOCATION){
            animSet.addAnimation(animAlpha2Opaque);
            animSet.addAnimation(animScaleZero2Normal);
            TranslateAnimation tranlate = new TranslateAnimation(
                    xCenter - xy[IDX_X], 0, yCenter - xy[IDX_Y], 0);
            animSet.addAnimation(tranlate);
        }
        animSet.setDuration(animDuration);
        animSet.setFillBefore(true);
        return animSet;
    }
    private void sortXYList(LinkedList<TextView> listTxt, int endIdx) {
        for (int i = 0; i < endIdx; i++) {
            for (int k = i+1; k < endIdx; k++) {
                if(((int[])listTxt.get(k).getTag())[IDX_DIS_Y] < ((int[])listTxt.get(i).getTag())[IDX_DIS_Y]){
                    TextView iTmp = listTxt.get(i);
                    TextView kTmp = listTxt.get(k);
                    listTxt.set(i, kTmp);
                    listTxt.set(k, iTmp);
                }
            }
        }
    }
    private boolean isXMixed(int startA, int endA, int startB, int endB) {
        boolean result = false;
        if(startB >= startA && startB <= endA){
            result = true;
        }else if (endB >= startA && endB <= endA){
            result = true;
        }else if (startA >= startB && startA <= endB){
            result = true;
        }else if (endA >= startB && endA <= endB){
            result =true;
        }
        return result;
    }
    private int[] randomXY(Random ran, LinkedList<Integer> listX,
                           LinkedList<Integer> listY, int xItem) {
        int[] arr = new int[4];
        arr[IDX_X] = listX.remove(ran.nextInt(listX.size()));
        arr[IDX_Y] = listY.remove(ran.nextInt(listY.size()));
        return arr;
    }
    public void onGlobalLayout() {
        int tmpW = getWidth();
        int tmpH = getHeight();
        if(width != tmpW || height != tmpH){
            width = tmpW;
            height =tmpH;
            show();
        }
    }
    public Vector<String> getKeywords(){
        return vecKeywords;
    }

    public void rubKeywords(){
        vecKeywords.clear();
    }

    public void rubAllViews(){
        removeAllViews();
    }

    public void setOnClickListener(OnClickListener listener){
        itemClickListener = listener;
    }

}

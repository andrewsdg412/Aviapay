package com.android.aviapay.appmanager;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.util.Log;
import android.webkit.JavascriptInterface;


public class BlacklistDatabaseHelper extends SQLiteOpenHelper {
    private static BlacklistDatabaseHelper sInstance;
    private String TAG;

    public static synchronized BlacklistDatabaseHelper getInstance(Context context) {
        // Use the application context, which will ensure that you
        // don't accidentally leak an Activity's context.
        // See this article for more information: http://bit.ly/6LRzfx
        if (sInstance == null) {
            sInstance = new BlacklistDatabaseHelper(context.getApplicationContext());
        }
        return sInstance;
    }

    // Database Info
    private static final String DATABASE_NAME = "blacklistDatabase";
    private static final int DATABASE_VERSION = 1;

    // Table Names
    private static final String TABLE_BLACKLIST = "blacklist";

    // Blacklist Table Columns
    private static final String KEY_HASH_ID = "blacklist_hash";

    public BlacklistDatabaseHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
        TAG = "BlacklistDatabaseHelper";
    }

    // Called when the database connection is being configured.
    // Configure database settings for things like foreign key support, write-ahead logging, etc.
    @Override
    public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        db.setForeignKeyConstraintsEnabled(true);
    }

    // Called when the database is created for the FIRST time.
    // If a database already exists on disk with the same DATABASE_NAME, this method will NOT be called.
    @Override
    public void onCreate(SQLiteDatabase db) {
        String CREATE_BLACKLIST_TABLE = "CREATE TABLE " + TABLE_BLACKLIST +
                "(" +
                    KEY_HASH_ID + " TEXT PRIMARY KEY" + // Define a primary key
                ")";
        db.execSQL(CREATE_BLACKLIST_TABLE);
    }

    // Called when the database needs to be upgraded.
    // This method will only be called if a database already exists on disk with the same DATABASE_NAME,
    // but the DATABASE_VERSION is different than the version of the database that exists on disk.
    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion != newVersion) {
            // Simplest implementation is to drop all old tables and recreate them
            db.execSQL("DROP TABLE IF EXISTS " + TABLE_BLACKLIST);
            onCreate(db);
        }
    }

    @JavascriptInterface
    public void addEntry(String entry) {
        // Create and/or open the database for writing
        SQLiteDatabase db = getWritableDatabase();

        if (!this.entryExists(entry)) {
            db.beginTransaction();
            try {
                ContentValues values = new ContentValues();
                values.put(KEY_HASH_ID, entry);
                db.insertOrThrow(TABLE_BLACKLIST, null, values);
                db.setTransactionSuccessful();
            } catch (Exception e) {
                Log.d(TAG, "Error while trying to add blacklist to database");
            } finally {
                db.endTransaction();
            }
        }
    }

    @JavascriptInterface
    public boolean entryExists(String entry) {
        SQLiteDatabase db = getWritableDatabase();
        String Query = "SELECT * from " + TABLE_BLACKLIST + " WHERE " + KEY_HASH_ID + " = '" + entry + "'";
        Cursor cursor = db.rawQuery(Query, null);
        if(cursor.getCount() <= 0){
            cursor.close();
            return false;
        }
        cursor.close();
        return true;
    }

    @JavascriptInterface
    public boolean deleteEntry(String entry) {
        String Query = "DELETE from " + TABLE_BLACKLIST + " WHERE " + KEY_HASH_ID + " = '" + entry + "'";
        SQLiteDatabase db = getWritableDatabase();
        Cursor cursor = db.rawQuery(Query, null);
        if(cursor.getCount() <= 0){
            cursor.close();
            return false;
        }
        cursor.close();
        return true;
    }

}

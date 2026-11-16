package top.ngopi.app.cekkes

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CekkesBackgroundModule(private val reactCtx: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactCtx) {

  override fun getName(): String = "CekkesBackgroundModule"

  @ReactMethod
  fun startForegroundImuService(promise: Promise) {
    try {
      val intent = Intent(reactCtx, CekkesForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactCtx.startForegroundService(intent)
      } else {
        reactCtx.startService(intent)
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CEKKES_SERVICE_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun stopForegroundImuService(promise: Promise) {
    try {
      val intent = Intent(reactCtx, CekkesForegroundService::class.java)
      reactCtx.stopService(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CEKKES_SERVICE_STOP_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun getLatestImuMetrics(promise: Promise) {
    try {
      val prefs = reactCtx.getSharedPreferences(
        CekkesForegroundService.PREFS_NAME,
        Context.MODE_PRIVATE
      )
      val map = Arguments.createMap().apply {
        putBoolean("running", prefs.getBoolean("running", false))
        putDouble("tremorHz", prefs.getFloat("tremorHz", 4.1f).toDouble())
        putInt("posturePitchDeg", prefs.getInt("posturePitchDeg", 50))
        putDouble("updatedAtMs", prefs.getLong("updatedAtMs", 0L).toDouble())
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("CEKKES_IMU_READ_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun hasUsageStatsPermission(promise: Promise) {
    try {
      val appOps = reactCtx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          reactCtx.packageName
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          reactCtx.packageName
        )
      }
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun openUsageStatsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactCtx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CEKKES_USAGE_SETTINGS_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun getUsageStatsSummary(hoursBack: Int, promise: Promise) {
    try {
      val usm = reactCtx.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
      if (usm == null) {
        promise.resolve(Arguments.createMap().apply {
          putInt("totalScreenMinutes", 0)
          putInt("activeAppCount", 0)
        })
        return
      }
      val end = System.currentTimeMillis()
      val start = end - (hoursBack.coerceIn(1, 24) * 3600L * 1000L)
      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end) ?: emptyList()

      var totalMs = 0L
      var activeApps = 0
      for (u in stats) {
        if (u.totalTimeInForeground > 60_000L) {
          totalMs += u.totalTimeInForeground
          activeApps++
        }
      }
      val map = Arguments.createMap().apply {
        putInt("totalScreenMinutes", (totalMs / 60_000L).toInt())
        putInt("activeAppCount", activeApps)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("CEKKES_USAGE_READ_ERR", e.message, e)
    }
  }
}

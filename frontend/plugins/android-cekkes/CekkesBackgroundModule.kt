package top.ngopi.app.cekkes

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Process
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class CekkesBackgroundModule(private val reactCtx: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactCtx), TextToSpeech.OnInitListener {

  private var tts: TextToSpeech? = null
  private var ttsReady = false
  private var pendingText: String? = null
  private var pendingLocale: Locale = Locale("id", "ID")
  private var activeRingtone: Ringtone? = null

  companion object {
    private const val MSG_CHANNEL_ID = "ngopi_messages_high"
    private const val CALL_CHANNEL_ID = "ngopi_calls_high"
    private const val CALL_NOTIFICATION_ID = 9901
  }

  override fun getName(): String = "CekkesBackgroundModule"

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      ttsReady = true
      tts?.language = pendingLocale
      pendingText?.let { text ->
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cekkes_doc_voice")
        pendingText = null
      }
    }
  }

  @ReactMethod
  fun speakText(text: String, langCode: String, promise: Promise) {
    try {
      val locale = if (langCode.startsWith("en")) Locale.US else Locale("id", "ID")
      pendingLocale = locale
      if (tts == null) {
        pendingText = text
        tts = TextToSpeech(reactCtx.applicationContext, this)
      } else if (ttsReady) {
        tts?.language = locale
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cekkes_doc_voice")
      } else {
        pendingText = text
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("CEKKES_TTS_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun stopSpeaking(promise: Promise) {
    try {
      pendingText = null
      tts?.stop()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun setLanguageCode(langCode: String, promise: Promise) {
    try {
      reactCtx.getSharedPreferences(CekkesForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString("langCode", if (langCode.startsWith("en")) "en" else "id")
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun startForegroundImuService(promise: Promise) {
    try {
      reactCtx.getSharedPreferences(CekkesForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean("running", true)
        .putLong("updatedAtMs", System.currentTimeMillis())
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun stopForegroundImuService(promise: Promise) {
    try {
      reactCtx.getSharedPreferences(CekkesForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean("running", false)
        .apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
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

  private fun ensureNotificationChannels(nm: NotificationManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val msgChannel = NotificationChannel(
        MSG_CHANNEL_ID,
        "Pesan & Update Ngopi",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifikasi pesan masuk, reaksi, dan update Ngopi"
        enableVibration(true)
      }
      nm.createNotificationChannel(msgChannel)

      val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      val audioAttrs = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val callChannel = NotificationChannel(
        CALL_CHANNEL_ID,
        "Panggilan Masuk Ngopi",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifikasi panggilan suara dan video call masuk"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 800, 500, 800)
        setSound(ringtoneUri, audioAttrs)
      }
      nm.createNotificationChannel(callChannel)
    }
  }

  private fun createLaunchPendingIntent(): PendingIntent {
    val launchIntent = reactCtx.packageManager.getLaunchIntentForPackage(reactCtx.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    } ?: Intent().apply {
      setPackage(reactCtx.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    return PendingIntent.getActivity(reactCtx, 1001, launchIntent, flags)
  }

  @ReactMethod
  fun showPushNotification(title: String, body: String, channelType: String, routePath: String, promise: Promise) {
    try {
      val nm = reactCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      ensureNotificationChannels(nm)
      val pendingIntent = createLaunchPendingIntent()
      val chId = if (channelType == "call") CALL_CHANNEL_ID else MSG_CHANNEL_ID
      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(reactCtx, chId)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(reactCtx)
      }
      builder
        .setSmallIcon(reactCtx.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)

      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        @Suppress("DEPRECATION")
        builder.setPriority(Notification.PRIORITY_HIGH)
        @Suppress("DEPRECATION")
        builder.setDefaults(Notification.DEFAULT_ALL)
      }

      val notifId = (System.currentTimeMillis() % 100000L).toInt() + 2000
      nm.notify(notifId, builder.build())
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun startIncomingCallAlert(callerName: String, isVideo: Boolean, routePath: String, promise: Promise) {
    try {
      val nm = reactCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      ensureNotificationChannels(nm)
      val pendingIntent = createLaunchPendingIntent()

      val title = if (isVideo) "Video Call Masuk • Ngopi" else "Panggilan Masuk • Ngopi"
      val body = "$callerName memanggil Anda. Ketuk untuk menjawab."

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(reactCtx, CALL_CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(reactCtx)
      }
      builder
        .setSmallIcon(reactCtx.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setOngoing(true)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)
        .setFullScreenIntent(pendingIntent, true)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        builder.setCategory(Notification.CATEGORY_CALL)
      }
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
        @Suppress("DEPRECATION")
        builder.setPriority(Notification.PRIORITY_MAX)
      }

      nm.notify(CALL_NOTIFICATION_ID, builder.build())

      // Play native Android ringtone + vibrate
      try {
        activeRingtone?.stop()
        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val rt = RingtoneManager.getRingtone(reactCtx.applicationContext, ringtoneUri)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          rt?.isLooping = true
        }
        rt?.play()
        activeRingtone = rt
      } catch (_: Exception) {}

      try {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val vm = reactCtx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
          vm?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          reactCtx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 700, 500), 0))
        } else {
          @Suppress("DEPRECATION")
          vibrator?.vibrate(longArrayOf(0, 700, 500), 0)
        }
      } catch (_: Exception) {}

      // Bring Ngopi app to foreground immediately for incoming voice/video call
      try {
        val launchIntent = reactCtx.packageManager.getLaunchIntentForPackage(reactCtx.packageName)?.apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        if (launchIntent != null) {
          reactCtx.startActivity(launchIntent)
        }
      } catch (_: Exception) {}

      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun stopIncomingCallAlert(promise: Promise) {
    try {
      activeRingtone?.stop()
      activeRingtone = null
    } catch (_: Exception) {}
    try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = reactCtx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        reactCtx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
      }
      vibrator?.cancel()
    } catch (_: Exception) {}
    try {
      val nm = reactCtx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.cancel(CALL_NOTIFICATION_ID)
    } catch (_: Exception) {}
    promise.resolve(true)
  }
}

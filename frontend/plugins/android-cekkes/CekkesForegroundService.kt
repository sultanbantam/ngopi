package top.ngopi.app.cekkes

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.sqrt

class CekkesForegroundService : Service(), SensorEventListener {
  private var sensorManager: SensorManager? = null
  private var accelSensor: Sensor? = null
  private var lastSavedMs: Long = 0L
  private var lastMag: Float = 9.81f
  private var crossCount: Int = 0
  private var windowStartMs: Long = 0L
  private var lastAlertNotifMs: Long = 0L

  companion object {
    const val CHANNEL_ID = "cekkes_health_monitor"
    const val ALERT_CHANNEL_ID = "cekkes_health_alerts"
    const val NOTIF_ID = 4301
    const val ALERT_NOTIF_ID = 4302
    const val PREFS_NAME = "cekkes_native_prefs"
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIF_ID, notification)
    }

    sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    accelSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    windowStartMs = System.currentTimeMillis()
    accelSensor?.let {
      sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL)
    }

    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("running", true)
      .apply()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
    val x = event.values[0]
    val y = event.values[1]
    val z = event.values[2]

    val mag = sqrt((x * x + y * y + z * z).toDouble()).toFloat()
    val delta = mag - lastMag
    if (abs(delta) > 0.12f) {
      crossCount++
    }
    lastMag = mag

    val now = System.currentTimeMillis()
    val elapsedSec = (now - windowStartMs) / 1000.0
    if (now - lastSavedMs >= 2000L && elapsedSec > 0.5) {
      lastSavedMs = now
      val pitchRad = atan2(abs(y.toDouble()), sqrt((x * x + z * z).toDouble()))
      val pitchDeg = Math.toDegrees(pitchRad).toInt().coerceIn(0, 90)
      val hz = ((crossCount / 2.0) / elapsedSec).toFloat().coerceIn(0.5f, 12.0f)

      getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putFloat("tremorHz", hz)
        .putInt("posturePitchDeg", pitchDeg)
        .putLong("updatedAtMs", now)
        .apply()

      // Send local status-bar push notification when strain is detected (2h cooldown)
      if ((pitchDeg < 35 || hz >= 6.5f) && (now - lastAlertNotifMs >= 7_200_000L)) {
        lastAlertNotifMs = now
        postAlertNotification(
          "dr. ceKKes AI — Pengingat Kesehatan",
          "Terdeteksi sudut leher ${pitchDeg}° & getaran ${String.format("%.1f", hz)} Hz. Ketuk untuk istirahat & cek saran."
        )
      }

      if (elapsedSec >= 5.0) {
        crossCount = 0
        windowStartMs = now
      }
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  override fun onDestroy() {
    sensorManager?.unregisterListener(this)
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean("running", false)
      .apply()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        CHANNEL_ID,
        "ceKKes Health Sensor Monitor",
        NotificationManager.IMPORTANCE_LOW
      )
      channel.description = "Pemantauan postur & getaran IMU untuk kesehatan mandiri ceKKes."
      mgr?.createNotificationChannel(channel)

      val alertChannel = NotificationChannel(
        ALERT_CHANNEL_ID,
        "ceKKes Health Alerts",
        NotificationManager.IMPORTANCE_DEFAULT
      )
      alertChannel.description = "Notifikasi peringatan kelelahan & jadwal kesehatan ceKKes AI."
      mgr?.createNotificationChannel(alertChannel)
    }
  }

  private fun postAlertNotification(title: String, body: String) {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pending = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        101,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else null

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, ALERT_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    builder
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setAutoCancel(true)
    if (pending != null) {
      builder.setContentIntent(pending)
    }
    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
    mgr?.notify(ALERT_NOTIF_ID, builder.build())
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle("ceKKes AI Aktif")
      .setContentText("Memantau postur & getaran IMU secara lokal (tanpa merekam isi).")
      .setSmallIcon(android.R.drawable.ic_menu_compass)
      .setOngoing(true)
      .build()
  }
}

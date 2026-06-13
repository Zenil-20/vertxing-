/*
 * Vertxing — native FCM receiver for full-screen incoming calls.
 * Wakes the screen and posts a full-screen-intent notification that launches
 * IncomingCallActivity over the lock screen — even when the app is killed.
 */
package com.vertxing.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class CallMessagingService extends FirebaseMessagingService {

    static final String CHANNEL_ID = "vertxing_calls";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (!"incoming-call".equals(data.get("type"))) return;

        String callId = data.get("callId");
        if (callId == null) return;
        String fromName = data.get("fromName") != null ? data.get("fromName") : "Someone";
        String mode = data.get("mode") != null ? data.get("mode") : "AUDIO";

        // Wake the device's screen.
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK
                            | PowerManager.ACQUIRE_CAUSES_WAKEUP
                            | PowerManager.ON_AFTER_RELEASE,
                    "vertxing:incoming-call");
            wl.acquire(15000);
        }

        createChannel();

        Intent fullScreen = new Intent(this, IncomingCallActivity.class);
        fullScreen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreen.putExtra("callId", callId);
        fullScreen.putExtra("fromName", fromName);
        fullScreen.putExtra("mode", mode);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullScreenPi = PendingIntent.getActivity(this, callId.hashCode(), fullScreen, piFlags);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_call_incoming)
                .setContentTitle("VIDEO".equals(mode) ? "Incoming video call" : "Incoming call")
                .setContentText(fromName + " is calling…")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(true)
                .setVibrate(new long[]{0, 400, 300, 400, 300, 400})
                .setFullScreenIntent(fullScreenPi, true)
                .setContentIntent(fullScreenPi)
                .build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(callId.hashCode(), notification);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Ringing for incoming calls");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Override
    public void onNewToken(String token) {
        // The web reads the token on demand via FcmPlugin.getToken() and registers
        // it with the API; nothing to do here.
    }
}

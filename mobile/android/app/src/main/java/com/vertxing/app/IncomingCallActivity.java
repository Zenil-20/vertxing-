/*
 * Vertxing — full-screen incoming-call screen. Appears over the lock screen and
 * turns the display on. Accept/Decline launch the main app deep-linked so the
 * existing web call flow takes over.
 */
package com.vertxing.app;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class IncomingCallActivity extends AppCompatActivity {

    private static final String WEB_BASE = "https://vertxing-web.vercel.app/app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over the lock screen and wake the display.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }

        setContentView(R.layout.activity_incoming_call);

        final String callId = getIntent().getStringExtra("callId");
        String fromName = getIntent().getStringExtra("fromName");
        String mode = getIntent().getStringExtra("mode");
        if (fromName == null) fromName = "Someone";
        if (mode == null) mode = "AUDIO";

        ((TextView) findViewById(R.id.caller_name)).setText(fromName);
        ((TextView) findViewById(R.id.call_subtitle))
                .setText("VIDEO".equals(mode) ? "Incoming video call" : "Incoming call");
        ((TextView) findViewById(R.id.caller_avatar))
                .setText(fromName.length() > 0 ? fromName.substring(0, 1).toUpperCase() : "?");

        final String fName = fromName;
        final String fMode = mode;

        findViewById(R.id.accept_button).setOnClickListener(v ->
                openApp("acceptCall=" + enc(callId) + "&from=" + enc(fName) + "&mode=" + enc(fMode), callId));
        findViewById(R.id.decline_button).setOnClickListener(v ->
                openApp("declineCall=" + enc(callId), callId));
    }

    private void openApp(String query, String callId) {
        // Cancel the ringing notification.
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && callId != null) nm.cancel(callId.hashCode());

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("deep_link_url", WEB_BASE + "?" + query);
        startActivity(intent);
        finish();
    }

    private static String enc(String s) {
        return s == null ? "" : Uri.encode(s);
    }
}

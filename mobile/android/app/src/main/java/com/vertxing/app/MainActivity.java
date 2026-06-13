/*
 * Vertxing — main Capacitor activity. Registers the FCM token bridge, requests
 * notification permission, and when launched from a full-screen call (Answer or
 * Decline) navigates the WebView to the deep-link so the existing web call flow
 * takes over.
 */
package com.vertxing.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FcmPlugin.class);
        super.onCreate(savedInstanceState);
        requestNotificationPermission();
        handleDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    /** Answer/Decline from the call screen → load the web deep-link. */
    private void handleDeepLink(Intent intent) {
        if (intent == null) return;
        final String url = intent.getStringExtra("deep_link_url");
        if (url == null || getBridge() == null || getBridge().getWebView() == null) return;
        getBridge().getWebView().postDelayed(
                () -> getBridge().getWebView().loadUrl(url), 700);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
        }
    }
}

package com.afms.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import android.webkit.WebResourceResponse;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.View;
import android.view.ViewGroup;
import android.graphics.Color;
import android.view.Gravity;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Subclass Capacitor's web view client to preserve its functionality while intercepting errors
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showOfflineScreen();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) {
                    showOfflineScreen();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                hideOfflineScreen();
            }
        });
    }

    private void hideOfflineScreen() {
        runOnUiThread(() -> {
            WebView webView = bridge.getWebView();
            if (webView == null) return;
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                View errorView = parent.findViewById(12345);
                if (errorView != null) {
                    parent.removeView(errorView);
                }
            }
        });
    }

    private void showOfflineScreen() {
        runOnUiThread(() -> {
            // Hide the splash screen plugin natively
            PluginHandle splashPlugin = bridge.getPlugin("SplashScreen");
            if (splashPlugin != null && splashPlugin.getInstance() != null) {
                try {
                    // Access the internal SplashScreen instance directly to call hideDialog
                    Object pluginInstance = splashPlugin.getInstance();
                    java.lang.reflect.Field splashScreenField = pluginInstance.getClass().getDeclaredField("splashScreen");
                    splashScreenField.setAccessible(true);
                    Object splashScreenObj = splashScreenField.get(pluginInstance);
                    
                    if (splashScreenObj != null) {
                        java.lang.reflect.Method hideDialogMethod = splashScreenObj.getClass().getMethod("hideDialog", androidx.appcompat.app.AppCompatActivity.class);
                        hideDialogMethod.invoke(splashScreenObj, MainActivity.this);
                    }
                } catch (Exception e) {
                    android.util.Log.e("OfflineScreen", "Failed to hide splash screen", e);
                }
            }

            WebView webView = bridge.getWebView();
            ViewGroup parent = (ViewGroup) webView.getParent();
            
            if (parent.findViewById(12345) != null) return;

            LinearLayout errorLayout = new LinearLayout(MainActivity.this);
            errorLayout.setId(12345);
            errorLayout.setOrientation(LinearLayout.VERTICAL);
            errorLayout.setGravity(Gravity.CENTER);
            errorLayout.setBackgroundColor(Color.parseColor("#0f172a"));
            errorLayout.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

            TextView errorText = new TextView(MainActivity.this);
            errorText.setText("Unable to connect to server.");
            errorText.setTextColor(Color.WHITE);
            errorText.setTextSize(18f);
            errorText.setPadding(0, 0, 0, 40);

            Button retryButton = new Button(MainActivity.this);
            retryButton.setText("Retry");
            retryButton.setOnClickListener(v -> {
                parent.removeView(errorLayout);
                webView.reload();
            });

            errorLayout.addView(errorText);
            errorLayout.addView(retryButton);

            parent.addView(errorLayout);
        });
    }
}

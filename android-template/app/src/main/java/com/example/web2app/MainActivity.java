package com.example.web2app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);

        // Add JS Bridge
        webView.addJavascriptInterface(new WebAppInterface(this), "Web2App");

        webView.setWebViewClient(new WebViewClient());
        
        // Load URL from resources - this will be replaced during generation
        String url = getString(R.string.start_url);
        webView.loadUrl(url);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class WebAppInterface {
        MainActivity mActivity;

        WebAppInterface(MainActivity c) {
            mActivity = c;
        }

        @JavascriptInterface
        public String readFile(String filename) {
            try {
                File file = new File(mActivity.getExternalFilesDir(null), filename);
                if (!file.exists()) return null;
                
                FileInputStream fis = new FileInputStream(file);
                int size = fis.available();
                byte[] buffer = new byte[size];
                fis.read(buffer);
                fis.close();
                return new String(buffer, StandardCharsets.UTF_8);
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }

        @JavascriptInterface
        public boolean writeFile(String filename, String content) {
            try {
                File file = new File(mActivity.getExternalFilesDir(null), filename);
                FileOutputStream fos = new FileOutputStream(file);
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.close();
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}

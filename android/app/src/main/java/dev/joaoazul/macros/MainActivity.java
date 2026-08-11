package dev.joaoazul.macros;

import android.os.Bundle;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Os assets da app correm em https://localhost e a API vive noutra
        // origem, por isso o cookie de sessão é third-party para o WebView.
        // O fetch é tratado pelo CORS, mas o handshake do WebSocket sairia sem
        // cookie (e levava 4401) se não abríssemos isto explicitamente.
        CookieManager.getInstance().setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }
}

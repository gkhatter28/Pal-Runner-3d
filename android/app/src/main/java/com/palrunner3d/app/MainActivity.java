package com.palrunner3d.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UnityAdsBannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

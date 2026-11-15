package com.palrunner3d.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.unity3d.ads.UnityAds;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UnityAdsBannerPlugin.class);
        super.onCreate(savedInstanceState);

        if (!UnityAds.isInitialized()) {
            UnityAds.initialize(getApplicationContext(), getString(R.string.unity_ads_game_id), false);
        }
    }
}

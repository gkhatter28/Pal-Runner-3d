package com.palrunner3d.app;

import android.app.Activity;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

@CapacitorPlugin(name = "UnityAdsBanner")
public class UnityAdsBannerPlugin extends Plugin {

    private static final String TAG = "UnityAdsBanner";
    private static final String DEFAULT_GAME_ID = "800438823";
    private static final String DEFAULT_PLACEMENT_ID = "BP_Banner_Android";

    private FrameLayout bannerContainer;
    private BannerView bannerView;

    @PluginMethod
    public void initialize(PluginCall call) {
        final String gameId = call.getString("gameId", DEFAULT_GAME_ID);
        final boolean testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));
        final Boolean personalizedAds = call.getBoolean("personalizedAds");

        if (personalizedAds != null) {
            UnityAds.setUserConsent(personalizedAds);
            UnityAds.setNonBehavioral(!personalizedAds);
        }

        if (UnityAds.isInitialized()) {
            JSObject result = new JSObject();
            result.put("initialized", true);
            call.resolve(result);
            return;
        }

        UnityAds.initialize(
            getContext().getApplicationContext(),
            gameId,
            testMode,
            new IUnityAdsInitializationListener() {
                @Override
                public void onInitializationComplete() {
                    JSObject result = new JSObject();
                    result.put("initialized", true);
                    call.resolve(result);
                }

                @Override
                public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                    Log.w(TAG, "Unity Ads init failed: " + error + " - " + message);
                    JSObject result = new JSObject();
                    result.put("initialized", false);
                    result.put("error", message);
                    call.resolve(result);
                }
            }
        );
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        final String gameId = call.getString("gameId", DEFAULT_GAME_ID);
        final String placementId = call.getString("placementId", DEFAULT_PLACEMENT_ID);
        final boolean testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));
        final Boolean personalizedAds = call.getBoolean("personalizedAds");

        if (personalizedAds != null) {
            UnityAds.setUserConsent(personalizedAds);
            UnityAds.setNonBehavioral(!personalizedAds);
        }

        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("Activity unavailable");
            return;
        }

        if (!UnityAds.isInitialized()) {
            UnityAds.initialize(
                getContext().getApplicationContext(),
                gameId,
                testMode,
                new IUnityAdsInitializationListener() {
                    @Override
                    public void onInitializationComplete() {
                        activity.runOnUiThread(() -> attachAndLoadBanner(activity, placementId));
                    }

                    @Override
                    public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                        Log.w(TAG, "Unity Ads init failed before banner: " + error + " - " + message);
                    }
                }
            );
            call.resolve();
            return;
        }

        activity.runOnUiThread(() -> attachAndLoadBanner(activity, placementId));
        call.resolve();
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(this::destroyBannerViews);
        call.resolve();
    }

    private void attachAndLoadBanner(Activity activity, String placementId) {
        if (activity.isFinishing() || activity.isDestroyed()) {
            return;
        }

        destroyBannerViews();

        View content = activity.findViewById(android.R.id.content);
        if (!(content instanceof ViewGroup)) {
            return;
        }
        ViewGroup root = (ViewGroup) content;

        bannerContainer = new FrameLayout(activity);
        FrameLayout.LayoutParams containerParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        bannerContainer.setLayoutParams(containerParams);

        bannerContainer.setOnApplyWindowInsetsListener((v, insets) -> {
            WindowInsetsCompat compat = WindowInsetsCompat.toWindowInsetsCompat(insets, v);
            Insets safeArea = compat.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) v.getLayoutParams();
            lp.setMargins(0, 0, 0, safeArea.bottom);
            v.setLayoutParams(lp);
            return insets;
        });

        bannerView = new BannerView(activity, placementId, new UnityBannerSize(320, 50));
        final BannerView currentBanner = bannerView;
        bannerView.setListener(
            new BannerView.Listener() {
                @Override
                public void onBannerLoaded(BannerView view) {
                    if (view != bannerView || bannerContainer == null) {
                        return;
                    }
                    bannerContainer.setVisibility(View.VISIBLE);
                    notifyListeners("unityBannerLoaded", new JSObject());
                }

                @Override
                public void onBannerFailedToLoad(BannerView view, BannerErrorInfo errorInfo) {
                    if (view != currentBanner) {
                        return;
                    }
                    String msg = errorInfo != null && errorInfo.errorMessage != null ? errorInfo.errorMessage : "Banner load failed";
                    Log.w(TAG, "Unity banner failed (" + placementId + "): " + msg);
                    activity.runOnUiThread(() -> {
                        if (bannerView == currentBanner) {
                            destroyBannerViews();
                        }
                    });
                    JSObject err = new JSObject();
                    err.put("message", msg);
                    notifyListeners("unityBannerFailedToLoad", err);
                }
            }
        );

        bannerContainer.addView(bannerView);
        root.addView(bannerContainer);
        bannerContainer.requestApplyInsets();
        bannerView.load();
    }

    private void destroyBannerViews() {
        if (bannerContainer != null) {
            ViewGroup parent = (ViewGroup) bannerContainer.getParent();
            if (parent != null) {
                parent.removeView(bannerContainer);
            }
            bannerContainer.removeAllViews();
            bannerContainer = null;
        }
        if (bannerView != null) {
            bannerView.destroy();
            bannerView = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyBannerViews();
        super.handleOnDestroy();
    }
}

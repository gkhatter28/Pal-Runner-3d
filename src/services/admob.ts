import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';

export const ADMOB_APP_ID = 'ca-app-pub-6043186517327565~7998012030';
export const ADMOB_AD_UNIT_ID = 'ca-app-pub-6043186517327565/1069466598';
export const UNITY_AD_PLACEMENT_ID = 'BP_Banner_Android';
export const UNITY_AD_UNIT_ID = '54fa67b9-1b1d-4c17-80cf-d6dd88292b3d';

let initialized = false;
let initPromise: Promise<void> | null = null;
let bannerActive = false;

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await AdMob.initialize({
        maxAdContentRating: MaxAdContentRating.General,
      });
      initialized = true;
    } catch {
      // Allow retry later if initialization failed
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function syncAdMobAudio(sfxEnabled: boolean, musicEnabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform() || !initialized) return;
  try {
    await AdMob.setApplicationMuted({ muted: !sfxEnabled && !musicEnabled });
  } catch {
    // Ignore audio sync errors
  }
}

export async function showBannerAd(personalizedAds: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform() || bannerActive) return;

  await initializeAdMob();
  if (!initialized) return;

  try {
    await AdMob.showBanner({
      adId: ADMOB_AD_UNIT_ID,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      npa: !personalizedAds,
    });
    bannerActive = true;
  } catch {
    bannerActive = false;
  }
}

export async function hideBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !bannerActive) return;
  bannerActive = false;
  try {
    await AdMob.removeBanner();
  } catch {
    // Ignore banner cleanup errors
  }
}

export type NativeAdOutcome = 'rewarded' | 'dismissed' | 'unavailable';

export async function showNativeAdMobAd(personalizedAds: boolean): Promise<NativeAdOutcome> {
  if (!Capacitor.isNativePlatform()) {
    return 'unavailable';
  }

  await initializeAdMob();
  if (!initialized) {
    return 'unavailable';
  }

  const options = {
    adId: ADMOB_AD_UNIT_ID,
    npa: !personalizedAds,
    immersiveMode: true,
  };

  // 1. Try Rewarded Video Ad unit first
  try {
    await AdMob.prepareRewardVideoAd(options);
    const reward = await AdMob.showRewardVideoAd();
    return reward && typeof reward.amount === 'number' ? 'rewarded' : 'dismissed';
  } catch (rewardErr) {
    const msg = rewardErr instanceof Error ? rewardErr.message.toLowerCase() : String(rewardErr).toLowerCase();
    // Only fall back to interstitial if the unit format itself doesn't match rewarded video
    const isFormatMismatch =
      msg.includes("doesn't match format") ||
      msg.includes('does not match') ||
      msg.includes('ad unit format');

    if (!isFormatMismatch) {
      return 'unavailable';
    }
  }

  // 2. Fallback if the configured unit ID is an Interstitial unit
  try {
    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    return 'rewarded';
  } catch {
    return 'unavailable';
  }
}

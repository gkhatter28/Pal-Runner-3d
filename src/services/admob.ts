import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';

export const ADMOB_APP_ID = 'ca-app-pub-6043186517327565~7998012030';
export const ADMOB_AD_UNIT_ID = 'ca-app-pub-6043186517327565/1069466598';
export const ADMOB_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-6043186517327565/6097541341';
export const UNITY_GAME_ID = '800438823';
export const UNITY_AD_PLACEMENT_ID = 'BP_Banner_Android';
export const UNITY_AD_UNIT_ID = '54fa67b9-1b1d-4c17-80cf-d6dd88292b3d';

interface UnityAdsBannerPluginInterface {
  initialize(options: {
    gameId: string;
    testMode?: boolean;
    personalizedAds?: boolean;
  }): Promise<{ initialized: boolean; error?: string }>;
  showBanner(options: {
    gameId: string;
    placementId: string;
    testMode?: boolean;
    personalizedAds?: boolean;
  }): Promise<void>;
  hideBanner(): Promise<void>;
}

const UnityAdsBanner = registerPlugin<UnityAdsBannerPluginInterface>('UnityAdsBanner');

let initialized = false;
let initPromise: Promise<void> | null = null;
let bannerActive = false;
let interstitialPrepared = false;
let interstitialLoading = false;
let interstitialShowing = false;

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await Promise.allSettled([
        AdMob.initialize({
          maxAdContentRating: MaxAdContentRating.General,
        }),
        UnityAdsBanner.initialize({
          gameId: UNITY_GAME_ID,
          testMode: false,
        }),
      ]);
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
    await UnityAdsBanner.showBanner({
      gameId: UNITY_GAME_ID,
      placementId: UNITY_AD_PLACEMENT_ID,
      testMode: false,
      personalizedAds,
    });
    bannerActive = true;
    return;
  } catch {
    // Fallback to AdMob banner if Unity banner bridge is unavailable
  }

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
  await Promise.allSettled([UnityAdsBanner.hideBanner(), AdMob.removeBanner()]);
}

export async function preloadInterstitialAd(personalizedAds: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform() || interstitialPrepared || interstitialLoading) return;

  await initializeAdMob();
  if (!initialized) return;

  interstitialLoading = true;
  try {
    await AdMob.prepareInterstitial({
      adId: ADMOB_INTERSTITIAL_AD_UNIT_ID,
      npa: !personalizedAds,
      immersiveMode: true,
    });
    interstitialPrepared = true;
  } catch {
    interstitialPrepared = false;
  } finally {
    interstitialLoading = false;
  }
}

export async function showInterstitialAd(personalizedAds: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || interstitialShowing) {
    return false;
  }

  await initializeAdMob();
  if (!initialized) {
    return false;
  }

  interstitialShowing = true;
  try {
    if (!interstitialPrepared) {
      await AdMob.prepareInterstitial({
        adId: ADMOB_INTERSTITIAL_AD_UNIT_ID,
        npa: !personalizedAds,
        immersiveMode: true,
      });
    }
    interstitialPrepared = false;
    await AdMob.showInterstitial({ adId: ADMOB_INTERSTITIAL_AD_UNIT_ID });
    void preloadInterstitialAd(personalizedAds);
    return true;
  } catch {
    interstitialPrepared = false;
    return false;
  } finally {
    interstitialShowing = false;
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

  // 1. Try Rewarded Video Ad unit first
  try {
    await AdMob.prepareRewardVideoAd({
      adId: ADMOB_AD_UNIT_ID,
      npa: !personalizedAds,
      immersiveMode: true,
    });
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

  // 2. Fallback to dedicated Interstitial Ad unit
  try {
    await AdMob.prepareInterstitial({
      adId: ADMOB_INTERSTITIAL_AD_UNIT_ID,
      npa: !personalizedAds,
      immersiveMode: true,
    });
    await AdMob.showInterstitial({ adId: ADMOB_INTERSTITIAL_AD_UNIT_ID });
    return 'rewarded';
  } catch {
    return 'unavailable';
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Play, Home, Settings, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { RunnerEngine } from './game/RunnerEngine';
import { soundEngine } from './audio/soundEngine';
import {
  hideBannerAd,
  initializeAdMob,
  preloadInterstitialAd,
  showBannerAd,
  showInterstitialAd,
  showNativeAdMobAd,
  syncAdMobAudio,
} from './services/admob';
import {
  deleteAllCloudAccountData,
  loadAndSyncCloudSave,
  loadLocalSave,
  persistLocalSave,
  saveProgressToCloud,
  signInWithGoogle,
  signOutAccount,
  subscribeToAuth,
} from './services/firebase';
import {
  DEFAULT_SAVE_STATE,
  getSkinById,
  type GamePhase,
  type IAPProduct,
  type LiveRunHUD,
  type PlayerSaveState,
  type RunSummary,
} from './types/game';
import { GameHUD } from './components/GameHUD';
import { MainMenuOverlay } from './components/MainMenuOverlay';
import { RunOverModal } from './components/RunOverModal';
import { CustomizationShopModal } from './components/CustomizationShopModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { StoreModal } from './components/StoreModal';
import { SettingsModal } from './components/SettingsModal';
import { AdPreviewModal } from './components/AdPreviewModal';

type ActiveModal = 'none' | 'shop' | 'leaderboard' | 'store' | 'settings';
type PendingAdKind = 'none' | 'revive' | 'coins';

const INITIAL_HUD: LiveRunHUD = {
  score: 0,
  distance: 0,
  runCoins: 0,
  speed: 18,
  multiplier: 1,
  hoverboardsLeft: 2,
  powerUps: {
    jetpack: 0,
    jetpackMax: 6,
    magnet: 0,
    magnetMax: 8,
    multiplier: 0,
    multiplierMax: 10,
    hoverboardActive: false,
  },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RunnerEngine | null>(null);

  const [save, setSave] = useState<PlayerSaveState>(() => loadLocalSave());
  const saveRef = useRef<PlayerSaveState>(save);
  saveRef.current = save;

  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const [phase, setPhase] = useState<GamePhase>('menu');
  const phaseRef = useRef<GamePhase>('menu');
  phaseRef.current = phase;

  const [hud, setHud] = useState<LiveRunHUD>(INITIAL_HUD);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [revivedThisRun, setRevivedThisRun] = useState(false);
  const revivedRef = useRef(false);
  revivedRef.current = revivedThisRun;

  const [activeModal, setActiveModal] = useState<ActiveModal>('none');
  const [settingsTab, setSettingsTab] = useState<'account' | 'gameplay' | 'ads' | 'privacy'>('account');
  const [pendingAd, setPendingAd] = useState<PendingAdKind>('none');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedLabel, setLastSyncedLabel] = useState('Not synced yet');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const adBusyRef = useRef(false);

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const commitSave = useCallback(
    async (updater: (prev: PlayerSaveState) => PlayerSaveState, syncCloud = true) => {
      const next = updater(saveRef.current);
      saveRef.current = next;
      setSave(next);
      persistLocalSave(next);
      soundEngine.setPreferences(next.audioSfx, next.audioMusic);
      void syncAdMobAudio(next.audioSfx, next.audioMusic);

      const currentUser = userRef.current;
      if (syncCloud && currentUser) {
        setSyncing(true);
        try {
          await saveProgressToCloud(currentUser, next);
          setLastSyncedLabel('Synced just now');
        } catch {
          setLastSyncedLabel('Local saved (cloud retry pending)');
        } finally {
          setSyncing(false);
        }
      }
    },
    [],
  );

  // Auth subscription & automatic cloud merge
  useEffect(() => {
    soundEngine.setPreferences(saveRef.current.audioSfx, saveRef.current.audioMusic);
    void initializeAdMob().then(() => {
      void syncAdMobAudio(saveRef.current.audioSfx, saveRef.current.audioMusic);
      if (!saveRef.current.adFree) {
        void preloadInterstitialAd(saveRef.current.personalizedAds);
      }
    });

    const unsub = subscribeToAuth(async (nextUser) => {
      setUser(nextUser);
      userRef.current = nextUser;
      if (nextUser) {
        setSyncing(true);
        try {
          const merged = await loadAndSyncCloudSave(nextUser, saveRef.current);
          saveRef.current = merged;
          setSave(merged);
          persistLocalSave(merged);
          soundEngine.setPreferences(merged.audioSfx, merged.audioMusic);
          engineRef.current?.setSkin(getSkinById(merged.equippedSkin));
          engineRef.current?.applyQualitySettings(merged.qualityPreset);
          setLastSyncedLabel('Synced with Cloud');
        } catch {
          setLastSyncedLabel('Cloud sync unavailable');
        } finally {
          setSyncing(false);
        }
      } else {
        setLastSyncedLabel('Guest mode (local save)');
      }
    });

    return () => unsub();
  }, []);

  // Show mediated banner only on the clean main menu when ads are enabled
  useEffect(() => {
    if (phase === 'menu' && activeModal === 'none' && !save.adFree) {
      void showBannerAd(save.personalizedAds);
    } else {
      void hideBannerAd();
    }
    return () => {
      void hideBannerAd();
    };
  }, [phase, activeModal, save.adFree, save.personalizedAds]);

  // Initialize Three.js RunnerEngine once inside dedicated container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RunnerEngine(mount, getSkinById(saveRef.current.equippedSkin), {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onCrash: (score, distance, coinsEarned) => {
        const current = saveRef.current;
        const isNewBest = score > current.highScore;
        setPhase('crashed');
        setRunSummary({
          score,
          distance,
          coinsEarned,
          isNewBest,
          revivedAlready: revivedRef.current,
        });

        void commitSave((prev) => ({
          ...prev,
          coins: prev.coins + coinsEarned,
          highScore: Math.max(prev.highScore, score),
          bestDistance: Math.max(prev.bestDistance, distance),
          totalRuns: prev.totalRuns + 1,
          hoverboards: Math.max(0, prev.hoverboards),
        }));
      },
      onContextLostChange: (lost) => setContextLost(lost),
    });

    engine.applyQualitySettings(saveRef.current.qualityPreset);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [commitSave]);

  // Global Pause shortcut (Escape / P)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Escape' && activeModal !== 'none') {
        setActiveModal('none');
        return;
      }
      if (activeModal !== 'none') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (phaseRef.current === 'playing') {
          engineRef.current?.setPhase('paused');
          setPhase('paused');
        } else if (phaseRef.current === 'paused') {
          engineRef.current?.setPhase('playing');
          setPhase('playing');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  const maybeShowPostRunInterstitial = useCallback(async () => {
    const s = saveRef.current;
    if (
      !Capacitor.isNativePlatform() ||
      s.adFree ||
      phaseRef.current !== 'crashed' ||
      revivedRef.current ||
      s.totalRuns < 2 ||
      s.totalRuns % 2 !== 0 ||
      adBusyRef.current
    ) {
      return;
    }
    adBusyRef.current = true;
    try {
      await showInterstitialAd(s.personalizedAds);
    } finally {
      adBusyRef.current = false;
    }
  }, []);

  const handleStartRun = useCallback(() => {
    soundEngine.playUiClick();
    if (adBusyRef.current) return;

    const launchRun = () => {
      setActiveModal('none');
      setRunSummary(null);
      setRevivedThisRun(false);
      setPhase('playing');
      const s = saveRef.current;
      engineRef.current?.startNewRun({
        magnetLevel: s.magnetLevel,
        jetpackLevel: s.jetpackLevel,
        multiplierLevel: s.multiplierLevel,
        hoverboards: s.hoverboards,
        qualityPreset: s.qualityPreset,
      });
      if (!s.adFree) {
        void preloadInterstitialAd(s.personalizedAds);
      }
    };

    if (phaseRef.current === 'crashed') {
      void maybeShowPostRunInterstitial().finally(launchRun);
      return;
    }

    launchRun();
  }, [maybeShowPostRunInterstitial]);

  const handlePause = () => {
    soundEngine.playUiClick();
    engineRef.current?.setPhase('paused');
    setPhase('paused');
  };

  const handleResume = () => {
    soundEngine.playUiClick();
    engineRef.current?.setPhase('playing');
    setPhase('playing');
  };

  const handleReturnHome = () => {
    soundEngine.playUiClick();
    if (adBusyRef.current) return;

    const goHome = () => {
      setRunSummary(null);
      engineRef.current?.setPhase('menu');
      setPhase('menu');
    };

    if (phaseRef.current === 'crashed') {
      void maybeShowPostRunInterstitial().finally(goHome);
      return;
    }

    goHome();
  };

  const handleActivateHoverboard = () => {
    const used = engineRef.current?.activateHoverboard();
    if (used) {
      void commitSave(
        (prev) => ({ ...prev, hoverboards: Math.max(0, prev.hoverboards - 1) }),
        false,
      );
    }
  };

  const grantAdReward = useCallback(
    (kind: 'revive' | 'coins') => {
      if (kind === 'revive') {
        setRevivedThisRun(true);
        setRunSummary(null);
        setPhase('playing');
        engineRef.current?.reviveRun();
      } else {
        soundEngine.playPowerUp();
        void commitSave((prev) => ({ ...prev, coins: prev.coins + 150 }));
        showNotice('+150 Coins claimed');
      }
    },
    [commitSave, showNotice],
  );

  const triggerRewardedAd = useCallback(
    async (kind: 'revive' | 'coins') => {
      if (adBusyRef.current) return;
      if (!Capacitor.isNativePlatform()) {
        setPendingAd(kind);
        return;
      }

      adBusyRef.current = true;
      showNotice('Loading ad...');
      try {
        const outcome = await showNativeAdMobAd(saveRef.current.personalizedAds);
        if (outcome === 'rewarded') {
          grantAdReward(kind);
        } else if (outcome === 'dismissed') {
          showNotice('Finish watching the ad to claim your reward');
        } else {
          setPendingAd(kind);
        }
      } finally {
        adBusyRef.current = false;
      }
    },
    [grantAdReward, showNotice],
  );

  const handleRequestRevive = () => {
    soundEngine.playUiClick();
    if (save.adFree) {
      grantAdReward('revive');
    } else {
      void triggerRewardedAd('revive');
    }
  };

  const handleAdCompleted = () => {
    const kind = pendingAd;
    setPendingAd('none');
    if (kind === 'revive' || kind === 'coins') {
      grantAdReward(kind);
    }
  };

  const handleSignIn = async () => {
    soundEngine.playUiClick();
    try {
      await signInWithGoogle();
      showNotice('Signed in with Google — Cloud Save synced');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in cancelled';
      showNotice(message);
    }
  };

  const handleSignOut = async () => {
    soundEngine.playUiClick();
    try {
      await signOutAccount();
      showNotice('Signed out — switched to local Guest mode');
    } catch {
      showNotice('Could not sign out right now — please try again');
    }
  };

  const handleManualSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const merged = await loadAndSyncCloudSave(user, saveRef.current);
      saveRef.current = merged;
      setSave(merged);
      persistLocalSave(merged);
      setLastSyncedLabel('Synced just now');
      showNotice('Cloud save synchronized');
    } catch {
      showNotice('Sync failed — check your connection');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectSkin = (skinId: string) => {
    soundEngine.playUiClick();
    engineRef.current?.setSkin(getSkinById(skinId));
    void commitSave((prev) => ({ ...prev, equippedSkin: skinId }));
  };

  const handleBuySkin = (skinId: string, cost: number) => {
    if (save.coins < cost) return;
    soundEngine.playPowerUp();
    engineRef.current?.setSkin(getSkinById(skinId));
    void commitSave((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      ownedSkins: Array.from(new Set([...prev.ownedSkins, skinId])),
      equippedSkin: skinId,
    }));
  };

  const handleUpgradePowerUp = (type: 'magnet' | 'jetpack' | 'multiplier', cost: number) => {
    if (save.coins < cost) return;
    soundEngine.playPowerUp();
    void commitSave((prev) => {
      if (type === 'magnet') {
        return { ...prev, coins: prev.coins - cost, magnetLevel: Math.min(5, prev.magnetLevel + 1) };
      }
      if (type === 'jetpack') {
        return { ...prev, coins: prev.coins - cost, jetpackLevel: Math.min(5, prev.jetpackLevel + 1) };
      }
      return { ...prev, coins: prev.coins - cost, multiplierLevel: Math.min(5, prev.multiplierLevel + 1) };
    });
  };

  const handleBuyHoverboard = () => {
    if (save.coins < 150) return;
    soundEngine.playCoin();
    void commitSave((prev) => ({
      ...prev,
      coins: prev.coins - 150,
      hoverboards: Math.min(999, prev.hoverboards + 1),
    }));
  };

  const handlePurchaseIap = (product: IAPProduct) => {
    soundEngine.playPowerUp();
    const stamp = new Date().toISOString().slice(0, 10);
    const receipt = `${product.id}:${stamp}`;
    void commitSave((prev) => {
      const nextSkins = product.unlocksSkinId
        ? Array.from(new Set([...prev.ownedSkins, product.unlocksSkinId]))
        : prev.ownedSkins;
      if (product.unlocksSkinId) {
        engineRef.current?.setSkin(getSkinById(product.unlocksSkinId));
      }
      return {
        ...prev,
        coins: prev.coins + product.coinsAwarded,
        hoverboards: Math.min(999, prev.hoverboards + product.hoverboardsAwarded),
        adFree: prev.adFree || Boolean(product.grantsAdFree),
        ownedSkins: nextSkins,
        equippedSkin: product.unlocksSkinId ?? prev.equippedSkin,
        purchases: [...prev.purchases, receipt].slice(-30),
      };
    });
  };

  const handleUpdateSettings = (patch: Partial<PlayerSaveState>) => {
    if (patch.qualityPreset) {
      engineRef.current?.applyQualitySettings(patch.qualityPreset);
    }
    void commitSave((prev) => ({ ...prev, ...patch }));
  };

  const handleDeleteAccountData = async () => {
    try {
      if (user) {
        await deleteAllCloudAccountData(user);
      }
      const fresh: PlayerSaveState = { ...DEFAULT_SAVE_STATE };
      saveRef.current = fresh;
      setSave(fresh);
      persistLocalSave(fresh);
      engineRef.current?.setSkin(getSkinById(fresh.equippedSkin));
      engineRef.current?.applyQualitySettings(fresh.qualityPreset);
      showNotice('Account data erased and progress reset');
    } catch {
      showNotice('Could not delete cloud account data — check connection and try again');
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 game-touch-surface">
      {/* Dedicated WebGL Mount Container (isolated from React HUD re-renders) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Context Lost Recovery Banner */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6">
            <AlertTriangle className="h-9 w-9 text-amber-400 mx-auto" />
            <h2 className="font-display text-lg font-bold text-white mt-3">
              Graphics Context Paused
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Waiting for device graphics memory to restore...
            </p>
          </div>
        </div>
      )}

      {/* Status Toast */}
      {statusNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-xs font-medium text-slate-100 shadow-xl">
          {statusNotice}
        </div>
      )}

      {/* Main Menu Overlay */}
      {phase === 'menu' && (
        <MainMenuOverlay
          save={save}
          user={user}
          syncing={syncing}
          onStartRun={handleStartRun}
          onOpenShop={() => {
            soundEngine.playUiClick();
            setActiveModal('shop');
          }}
          onOpenLeaderboard={() => {
            soundEngine.playUiClick();
            setActiveModal('leaderboard');
          }}
          onOpenStore={() => {
            soundEngine.playUiClick();
            setActiveModal('store');
          }}
          onOpenSettings={() => {
            soundEngine.playUiClick();
            setSettingsTab('account');
            setActiveModal('settings');
          }}
          onWatchCoinAd={() => {
            soundEngine.playUiClick();
            void triggerRewardedAd('coins');
          }}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {/* Active Gameplay HUD */}
      {phase === 'playing' && (
        <GameHUD
          hud={hud}
          touchControls={save.touchControls}
          onPause={handlePause}
          onActivateHoverboard={handleActivateHoverboard}
          onMoveLeft={() => engineRef.current?.moveLeft()}
          onMoveRight={() => engineRef.current?.moveRight()}
          onJump={() => engineRef.current?.jump()}
          onRoll={() => engineRef.current?.roll()}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Run Paused</h2>
            <p className="text-xs text-slate-400 mt-1 font-mono-num">
              Score {hud.score.toLocaleString()} · {hud.distance}m
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResume}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                <span>Resume Run</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab('gameplay');
                  setActiveModal('settings');
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm font-medium text-slate-100"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={handleReturnHome}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm font-medium text-slate-100"
              >
                <Home className="h-4 w-4" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Run Summary Modal */}
      {phase === 'crashed' && runSummary && (
        <RunOverModal
          summary={runSummary}
          adFree={save.adFree}
          onRevive={handleRequestRevive}
          onPlayAgain={handleStartRun}
          onReturnHome={handleReturnHome}
          onOpenLeaderboard={() => {
            setPhase('menu');
            engineRef.current?.setPhase('menu');
            setActiveModal('leaderboard');
          }}
        />
      )}

      {/* Modals */}
      {activeModal === 'shop' && (
        <CustomizationShopModal
          save={save}
          onClose={() => setActiveModal('none')}
          onSelectSkin={handleSelectSkin}
          onBuySkin={handleBuySkin}
          onUpgradePowerUp={handleUpgradePowerUp}
          onBuyHoverboard={handleBuyHoverboard}
        />
      )}

      {activeModal === 'leaderboard' && (
        <LeaderboardModal
          user={user}
          onClose={() => setActiveModal('none')}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {activeModal === 'store' && (
        <StoreModal
          save={save}
          onClose={() => setActiveModal('none')}
          onPurchaseProduct={handlePurchaseIap}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          save={save}
          user={user}
          syncing={syncing}
          lastSyncedLabel={lastSyncedLabel}
          initialTab={settingsTab}
          onClose={() => setActiveModal('none')}
          onSignIn={() => void handleSignIn()}
          onSignOut={() => void handleSignOut()}
          onManualSync={() => void handleManualSync()}
          onUpdateSettings={handleUpdateSettings}
          onDeleteAccountData={handleDeleteAccountData}
        />
      )}

      {/* Rewarded Ad Preview */}
      {pendingAd !== 'none' && (
        <AdPreviewModal
          rewardLabel={pendingAd === 'revive' ? 'Revive & Continue Run' : '+150 Coins'}
          personalizedAds={save.personalizedAds}
          onComplete={handleAdCompleted}
          onCancel={() => setPendingAd('none')}
        />
      )}
    </div>
  );
}

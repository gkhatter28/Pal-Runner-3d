import {
  Play,
  Shirt,
  Trophy,
  ShoppingBag,
  Settings,
  Tv,
  LogIn,
  Cloud,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import { getSkinById, type PlayerSaveState } from '../types/game';

interface MainMenuOverlayProps {
  save: PlayerSaveState;
  user: User | null;
  syncing: boolean;
  onStartRun: () => void;
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onOpenStore: () => void;
  onOpenSettings: () => void;
  onWatchCoinAd: () => void;
  onSignIn: () => void;
}

export function MainMenuOverlay({
  save,
  user,
  syncing,
  onStartRun,
  onOpenShop,
  onOpenLeaderboard,
  onOpenStore,
  onOpenSettings,
  onWatchCoinAd,
  onSignIn,
}: MainMenuOverlayProps) {
  const activeSkin = getSkinById(save.equippedSkin);

  const reserveNativeBannerSpace = Capacitor.isNativePlatform() && !save.adFree;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 ${
        reserveNativeBannerSpace ? 'pb-16 sm:pb-20' : ''
      }`}
    >
      {/* 3-Zone Top Bar */}
      <header className="pointer-events-auto flex items-center justify-between gap-4 bg-slate-950/88 border border-slate-800 rounded-2xl px-4 sm:px-6 py-3 shadow-xl">
        {/* Zone 1: Wordmark */}
        <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Pal Runner 3D
        </div>

        {/* Zone 2: Clean unboxed metadata */}
        <div className="hidden md:flex items-center gap-3 text-sm text-slate-300 font-mono-num">
          <span>Best {save.highScore.toLocaleString()}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold">{save.coins.toLocaleString()} Coins</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-cyan-400">{save.hoverboards} Shields</span>
        </div>

        {/* Zone 3: Account & Settings */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Cloud className="h-4 w-4 text-cyan-400" />
              <span className="max-w-[110px] truncate">{user.displayName ?? 'Synced'}</span>
              {syncing && <span className="text-xs text-slate-400">Syncing</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs sm:text-sm font-medium text-slate-100 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="h-4 w-4 text-amber-400" />
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile compact stats bar */}
      <div className="md:hidden pointer-events-auto self-start mt-2 bg-slate-950/85 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs font-mono-num">
        <span className="text-slate-200">Best {save.highScore.toLocaleString()}</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="text-amber-400 font-semibold">{save.coins.toLocaleString()} Coins</span>
      </div>

      {/* Center stays 100% open to showcase the live 3D runner and moving subway */}
      <div className="flex-1" />

      {/* Bottom Dock */}
      <div className="pointer-events-auto mx-auto w-full max-w-3xl bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-400">
              Equipped Runner · {activeSkin.name}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
              Ready to Sprint the Rails
            </h1>
          </div>

          <button
            type="button"
            onClick={onStartRun}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] px-7 py-3.5 text-base font-bold text-slate-950 transition-all shadow-lg whitespace-nowrap shrink-0"
          >
            <Play className="h-5 w-5 fill-slate-950" />
            <span>Start Run</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/90 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenShop}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Shirt className="h-4 w-4 text-cyan-400" />
            <span>Skins & Upgrades</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>Leaderboards</span>
          </button>

          <button
            type="button"
            onClick={onOpenStore}
            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-400" />
            <span>Store</span>
          </button>

          {!save.adFree && (
            <button
              type="button"
              onClick={onWatchCoinAd}
              className="flex items-center gap-2 rounded-xl bg-slate-900 border border-amber-500/40 hover:border-amber-400 px-4 py-2.5 text-sm font-medium text-amber-300 transition-colors whitespace-nowrap shrink-0 ml-auto"
            >
              <Tv className="h-4 w-4" />
              <span>Free +150 Coins</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

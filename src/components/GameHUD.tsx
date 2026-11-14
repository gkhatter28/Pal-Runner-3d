import { Pause, Shield, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import type { LiveRunHUD } from '../types/game';

interface GameHUDProps {
  hud: LiveRunHUD;
  touchControls: boolean;
  onPause: () => void;
  onActivateHoverboard: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onRoll: () => void;
}

export function GameHUD({
  hud,
  touchControls,
  onPause,
  onActivateHoverboard,
  onMoveLeft,
  onMoveRight,
  onJump,
  onRoll,
}: GameHUDProps) {
  const { powerUps } = hud;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-4">
        {/* Score & Distance */}
        <div className="bg-slate-950/85 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono-num text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {hud.score.toLocaleString()}
            </span>
            {hud.multiplier > 1 && (
              <span className="font-display text-sm font-bold text-purple-400">
                {hud.multiplier}x
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-num">
            <span>{hud.distance} m</span>
            <span aria-hidden="true">·</span>
            <span>{hud.speed} km/h</span>
          </div>
        </div>

        {/* Active Power-ups (Center Top) */}
        <div className="hidden sm:flex flex-col items-center gap-2 min-w-[200px]">
          {powerUps.jetpack > 0 && (
            <PowerBar label="Jetpack" remaining={powerUps.jetpack} max={powerUps.jetpackMax} barClass="bg-orange-500" />
          )}
          {powerUps.magnet > 0 && (
            <PowerBar label="Magnet" remaining={powerUps.magnet} max={powerUps.magnetMax} barClass="bg-red-500" />
          )}
          {powerUps.multiplier > 0 && (
            <PowerBar label="2x Score" remaining={powerUps.multiplier} max={powerUps.multiplierMax} barClass="bg-purple-500" />
          )}
          {powerUps.hoverboardActive && (
            <div className="bg-slate-950/90 border border-cyan-500/50 rounded-lg px-3 py-1 text-xs font-medium text-cyan-300">
              Hoverboard Shield Active
            </div>
          )}
        </div>

        {/* Coins & Pause */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/85 border border-slate-800 rounded-xl px-3.5 py-2 text-right shadow-lg">
            <div className="text-[11px] font-medium text-amber-400">Coins</div>
            <div className="font-mono-num text-lg sm:text-xl font-bold text-amber-300">
              +{hud.runCoins.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause run"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/85 border border-slate-700 text-slate-100 hover:bg-slate-800 active:scale-95 transition-transform shadow-lg"
          >
            <Pause className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Compact Power-up Bars */}
      <div className="flex sm:hidden flex-col items-start gap-1.5 mt-2">
        {powerUps.jetpack > 0 && (
          <PowerBar label="Jetpack" remaining={powerUps.jetpack} max={powerUps.jetpackMax} barClass="bg-orange-500" />
        )}
        {powerUps.magnet > 0 && (
          <PowerBar label="Magnet" remaining={powerUps.magnet} max={powerUps.magnetMax} barClass="bg-red-500" />
        )}
        {powerUps.multiplier > 0 && (
          <PowerBar label="2x Score" remaining={powerUps.multiplier} max={powerUps.multiplierMax} barClass="bg-purple-500" />
        )}
      </div>

      {/* Bottom Controls Row */}
      <div className="flex items-end justify-between gap-4 mt-auto">
        {touchControls ? (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onPointerDown={onMoveLeft}
              aria-label="Move Left"
              className="flex h-13 w-13 items-center justify-center rounded-xl bg-slate-950/80 border border-slate-700 text-white active:bg-slate-800"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onPointerDown={onJump}
                aria-label="Jump"
                className="flex h-12 w-13 items-center justify-center rounded-xl bg-slate-950/80 border border-slate-700 text-white active:bg-slate-800"
              >
                <ArrowUp className="h-6 w-6" />
              </button>
              <button
                type="button"
                onPointerDown={onRoll}
                aria-label="Roll"
                className="flex h-12 w-13 items-center justify-center rounded-xl bg-slate-950/80 border border-slate-700 text-white active:bg-slate-800"
              >
                <ArrowDown className="h-6 w-6" />
              </button>
            </div>
            <button
              type="button"
              onPointerDown={onMoveRight}
              aria-label="Move Right"
              className="flex h-13 w-13 items-center justify-center rounded-xl bg-slate-950/80 border border-slate-700 text-white active:bg-slate-800"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-300/85 bg-slate-950/75 border border-slate-800/80 rounded-lg px-3 py-1.5">
            Swipe or Arrow keys to dodge · Double-tap or E for Shield
          </div>
        )}

        <button
          type="button"
          onClick={onActivateHoverboard}
          disabled={hud.hoverboardsLeft <= 0 || powerUps.hoverboardActive}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 shadow-lg ${
            powerUps.hoverboardActive
              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
              : hud.hoverboardsLeft > 0
                ? 'bg-slate-950/90 border-cyan-500/50 text-cyan-300 hover:bg-slate-900 active:scale-95'
                : 'bg-slate-950/70 border-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Shield</span>
          <span className="font-mono-num text-xs opacity-90">({hud.hoverboardsLeft})</span>
        </button>
      </div>
    </div>
  );
}

function PowerBar({
  label,
  remaining,
  max,
  barClass,
}: {
  label: string;
  remaining: number;
  max: number;
  barClass: string;
}) {
  const pct = Math.max(0, Math.min(100, (remaining / Math.max(1, max)) * 100));
  return (
    <div className="w-44 bg-slate-950/85 border border-slate-800 rounded-lg px-3 py-1.5 shadow">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-slate-200">{label}</span>
        <span className="font-mono-num text-slate-400">{remaining.toFixed(1)}s</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all duration-75`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

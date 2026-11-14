import { RotateCcw, Home, Tv, ShieldCheck, Trophy } from 'lucide-react';
import type { RunSummary } from '../types/game';

interface RunOverModalProps {
  summary: RunSummary;
  adFree: boolean;
  onRevive: () => void;
  onPlayAgain: () => void;
  onReturnHome: () => void;
  onOpenLeaderboard: () => void;
}

export function RunOverModal({
  summary,
  adFree,
  onRevive,
  onPlayAgain,
  onReturnHome,
  onOpenLeaderboard,
}: RunOverModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold text-white">Run Complete</h2>
          {summary.isNewBest && (
            <span className="text-xs font-bold text-amber-400">New Personal Best</span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <div className="text-xs text-slate-400">Score</div>
            <div className="font-mono-num text-lg font-bold text-white mt-0.5">
              {summary.score.toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <div className="text-xs text-slate-400">Distance</div>
            <div className="font-mono-num text-lg font-bold text-cyan-400 mt-0.5">
              {summary.distance}m
            </div>
          </div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <div className="text-xs text-slate-400">Coins</div>
            <div className="font-mono-num text-lg font-bold text-amber-400 mt-0.5">
              +{summary.coinsEarned}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!summary.revivedAlready && (
            <button
              type="button"
              onClick={onRevive}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors"
            >
              {adFree ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Instant Revive (Ad-Free Pass)</span>
                </>
              ) : (
                <>
                  <Tv className="h-4 w-4" />
                  <span>Watch Ad to Revive & Continue</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onPlayAgain}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Run Again</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition-colors"
            >
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Rankings</span>
            </button>
            <button
              type="button"
              onClick={onReturnHome}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition-colors"
            >
              <Home className="h-4 w-4 text-slate-300" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

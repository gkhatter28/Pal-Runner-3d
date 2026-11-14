import { useEffect, useState } from 'react';
import { Tv, CheckCircle2 } from 'lucide-react';

interface AdPreviewModalProps {
  rewardLabel: string;
  personalizedAds: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

export function AdPreviewModal({
  rewardLabel,
  personalizedAds,
  onComplete,
  onCancel,
}: AdPreviewModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  const progress = ((5 - secondsLeft) / 5) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Sponsored Reward Preview</span>
          <span>{personalizedAds ? 'Personalized' : 'Standard (Non-Personalized)'}</span>
        </div>

        <div className="mt-4 rounded-xl bg-gradient-to-br from-amber-500/20 via-slate-950 to-cyan-500/20 border border-slate-800 p-6 text-center">
          <Tv className="h-10 w-10 text-amber-400 mx-auto" />
          <h3 className="font-display text-xl font-bold text-white mt-3">
            Metro Transit Express Gear
          </h3>
          <p className="text-sm text-slate-300 mt-1.5">
            Upgrade your hoverboard and coin magnet in the Store or remove ads forever with the Ad-Free Pass.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>Reward: {rewardLabel}</span>
            <span className="font-mono-num">
              {secondsLeft > 0 ? `Unlocks in ${secondsLeft}s` : 'Reward Ready'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={onComplete}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
              secondsLeft > 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Claim Reward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

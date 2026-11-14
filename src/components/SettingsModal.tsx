import { useState } from 'react';
import {
  X,
  Cloud,
  LogIn,
  LogOut,
  Sliders,
  Shield,
  FileText,
  Copy,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { deriveFriendCode, type PlayerSaveState, type QualityPreset } from '../types/game';

interface SettingsModalProps {
  save: PlayerSaveState;
  user: User | null;
  syncing: boolean;
  lastSyncedLabel: string;
  initialTab?: 'account' | 'gameplay' | 'ads' | 'privacy';
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onManualSync: () => void;
  onUpdateSettings: (patch: Partial<PlayerSaveState>) => void;
  onDeleteAccountData: () => Promise<void>;
}

export function SettingsModal({
  save,
  user,
  syncing,
  lastSyncedLabel,
  initialTab = 'account',
  onClose,
  onSignIn,
  onSignOut,
  onManualSync,
  onUpdateSettings,
  onDeleteAccountData,
}: SettingsModalProps) {
  const [tab, setTab] = useState<'account' | 'gameplay' | 'ads' | 'privacy'>(initialTab);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const friendCode = user ? deriveFriendCode(user.uid) : '';

  const handleCopy = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await onDeleteAccountData();
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-950/80 p-0 sm:p-6">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white">Settings & Account</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-4 overflow-x-auto">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <TabBtn active={tab === 'account'} onClick={() => setTab('account')} icon={<Cloud className="h-3.5 w-3.5" />} label="Account & Sync" />
            <TabBtn active={tab === 'gameplay'} onClick={() => setTab('gameplay')} icon={<Sliders className="h-3.5 w-3.5" />} label="Graphics & Audio" />
            <TabBtn active={tab === 'ads'} onClick={() => setTab('ads')} icon={<Shield className="h-3.5 w-3.5" />} label="Ads & Billing" />
            <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} icon={<FileText className="h-3.5 w-3.5" />} label="Privacy Policy" />
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {tab === 'account' && (
            <div className="space-y-4">
              {user ? (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {user.displayName ?? 'Pal Runner'}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{user.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Social Friend Code</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono-num text-sm font-bold text-cyan-400 tracking-wider">
                          {friendCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopy()}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200"
                        >
                          <Copy className="h-3 w-3" />
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-400">Cloud Save Status</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-emerald-400">{lastSyncedLabel}</span>
                        <button
                          type="button"
                          onClick={onManualSync}
                          disabled={syncing}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950"
                        >
                          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                          <span>Sync Now</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-5">
                  <h3 className="font-display text-lg font-bold text-white">
                    Cloud Save & Social Sign-In
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Currently playing as Guest (saved locally on this browser). Sign in with Google to sync coins, skins, and upgrades across devices and join the global leaderboard.
                  </p>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>Sign In with Google</span>
                  </button>
                </div>
              )}

              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-400">High Score</div>
                  <div className="font-mono-num text-base font-bold text-white mt-0.5">
                    {save.highScore.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Best Distance</div>
                  <div className="font-mono-num text-base font-bold text-cyan-400 mt-0.5">
                    {save.bestDistance.toLocaleString()}m
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Total Runs</div>
                  <div className="font-mono-num text-base font-bold text-amber-400 mt-0.5">
                    {save.totalRuns}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Graphics Quality</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Choose Performance Mode for smoother framerates on older phones & laptops.
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'auto', label: 'Auto' },
                      { id: 'low', label: 'Performance' },
                      { id: 'high', label: 'High Fidelity' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateSettings({ qualityPreset: opt.id as QualityPreset })}
                      className={`rounded-lg py-2 px-3 text-xs font-semibold border transition-colors ${
                        save.qualityPreset === opt.id
                          ? 'bg-amber-500 border-amber-400 text-slate-950'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                title="Sound Effects"
                description="Coins, jumps, power-ups, and shield impacts"
                checked={save.audioSfx}
                onChange={(v) => onUpdateSettings({ audioSfx: v })}
              />
              <ToggleRow
                title="Synth Runner Music"
                description="Procedural upbeat rhythm during active runs"
                checked={save.audioMusic}
                onChange={(v) => onUpdateSettings({ audioMusic: v })}
              />
              <ToggleRow
                title="On-Screen Touch Buttons"
                description="Displays directional buttons in addition to swipe gestures"
                checked={save.touchControls}
                onChange={(v) => onUpdateSettings({ touchControls: v })}
              />
            </div>
          )}

          {tab === 'ads' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Ad-Free Express Pass</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {save.adFree
                      ? 'Active — Rewarded revives are instant with no ad previews.'
                      : 'Inactive — Purchase in Store to remove all ads and unlock instant revives.'}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold ${
                    save.adFree ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {save.adFree ? 'Active' : 'Standard'}
                </span>
              </div>

              <ToggleRow
                title="Personalized Ad Previews"
                description="Controls whether rewarded ad previews use personalized recommendations"
                checked={save.personalizedAds}
                onChange={(v) => onUpdateSettings({ personalizedAds: v })}
              />

              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
                <div className="text-sm font-semibold text-white mb-2">Purchase History</div>
                {save.purchases.length === 0 ? (
                  <p className="text-xs text-slate-400">No store purchases recorded yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-300 font-mono-num">
                    {save.purchases.slice().reverse().map((p, i) => (
                      <li key={i} className="flex items-center justify-between border-b border-slate-800/70 pb-1">
                        <span>{p}</span>
                        <span className="text-emerald-400">Fulfilled</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3 text-xs text-slate-300 leading-relaxed">
                <h3 className="font-display text-base font-bold text-white">
                  Pal Runner 3D Privacy Policy
                </h3>
                <p>
                  <strong className="text-white">1. Data We Collect:</strong> When you play as a Guest, your coins, unlocked outfits, upgrade levels, and settings are stored locally in your browser. When you sign in with Google, we store your game save in Cloud Firestore (<span className="font-mono-num">/saves</span>), isolate your verified email address in a strictly private document (<span className="font-mono-num">/users_private</span>) accessible only to you, and publish your chosen display name, friend code, and high score on the competitive leaderboard (<span className="font-mono-num">/leaderboard</span>).
                </p>
                <p>
                  <strong className="text-white">2. Social & Friends:</strong> Your public leaderboard record never exposes your email address. Friends can only connect with you using your shareable Friend Code and your explicit acceptance of incoming friend requests.
                </p>
                <p>
                  <strong className="text-white">3. Advertising & Purchases:</strong> Optional rewarded ad previews can be switched between personalized and non-personalized modes at any time under the Ads & Billing tab. In-app purchase receipts are stored solely to restore your coins, hoverboards, and Ad-Free Pass across devices.
                </p>
                <p>
                  <strong className="text-white">4. Your Rights & Data Deletion:</strong> You may delete your cloud save, private account record, and public leaderboard entry permanently at any time using the button below.
                </p>
              </div>

              <div className="rounded-xl bg-red-950/30 border border-red-500/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-red-200">Delete Account & Reset Data</div>
                  <div className="text-xs text-red-300/80">
                    Permanently erases cloud save, leaderboard entry, and local progress.
                  </div>
                </div>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 px-4 py-2 text-xs font-bold text-red-200 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Data</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDeleteAll()}
                      className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-xs font-bold text-white"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Erase'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
        active ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          checked ? 'bg-amber-500 border-amber-400' : 'bg-slate-800 border-slate-700'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

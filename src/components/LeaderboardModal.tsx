import { useEffect, useState, useCallback } from 'react';
import {
  X,
  Trophy,
  Users,
  UserPlus,
  Check,
  Trash2,
  Copy,
  LogIn,
  RefreshCw,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  acceptFriendRequest,
  fetchFriendsLeaderboard,
  fetchFriendships,
  fetchGlobalLeaderboard,
  findPlayerByFriendCode,
  removeFriendship,
  sendFriendRequest,
} from '../services/firebase';
import {
  deriveFriendCode,
  getSkinById,
  type FriendshipRecord,
  type LeaderboardEntry,
} from '../types/game';

interface LeaderboardModalProps {
  user: User | null;
  onClose: () => void;
  onSignIn: () => void;
}

function formatLeaderboardError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      if (parsed.error.toLowerCase().includes('permission')) {
        return 'Permission error while updating leaderboard data. Please sign in again.';
      }
      if (parsed.error.toLowerCase().includes('offline')) {
        return 'You appear to be offline. Rankings will load once connected.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return err.message || fallback;
}

export function LeaderboardModal({ user, onClose, onSignIn }: LeaderboardModalProps) {
  const [tab, setTab] = useState<'global' | 'friends'>('global');
  const [globalRows, setGlobalRows] = useState<LeaderboardEntry[]>([]);
  const [friendRows, setFriendRows] = useState<LeaderboardEntry[]>([]);
  const [friendships, setFriendships] = useState<FriendshipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendMsg, setFriendMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const globalData = await fetchGlobalLeaderboard();
      setGlobalRows(globalData);

      if (user) {
        const fList = await fetchFriendships(user.uid);
        setFriendships(fList);
        const fBoard = await fetchFriendsLeaderboard(user, fList);
        setFriendRows(fBoard);
      }
    } catch (err) {
      setError(formatLeaderboardError(err, 'Could not load rankings.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const myCode = user ? deriveFriendCode(user.uid) : '';

  const handleCopyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFriendMsg(null);
    try {
      const target = await findPlayerByFriendCode(friendCodeInput);
      if (!target) {
        setFriendMsg('No runner found with that friend code.');
        return;
      }
      await sendFriendRequest(user, target);
      setFriendCodeInput('');
      setFriendMsg(`Friend request sent to ${target.displayName}.`);
      await loadData();
    } catch (err) {
      setFriendMsg(formatLeaderboardError(err, 'Unable to send friend request.'));
    }
  };

  const handleAccept = async (id: string) => {
    setFriendMsg(null);
    try {
      await acceptFriendRequest(id);
      await loadData();
    } catch (err) {
      setFriendMsg(formatLeaderboardError(err, 'Unable to accept friend request.'));
    }
  };

  const handleRemove = async (id: string) => {
    setFriendMsg(null);
    try {
      await removeFriendship(id);
      await loadData();
    } catch (err) {
      setFriendMsg(formatLeaderboardError(err, 'Unable to remove friend request.'));
    }
  };

  const incomingRequests = user
    ? friendships.filter((f) => f.targetId === user.uid && f.status === 'pending')
    : [];

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-6">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-xl font-bold text-white">Leaderboards & Friends</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              aria-label="Refresh leaderboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close leaderboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 flex items-center justify-between gap-4">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setTab('global')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === 'global' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Global Top 25
            </button>
            <button
              type="button"
              onClick={() => setTab('friends')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === 'friends' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Friends</span>
              {incomingRequests.length > 0 && (
                <span className="font-mono-num text-xs font-bold">({incomingRequests.length})</span>
              )}
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-500/15 border border-red-500/40 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          {tab === 'global' ? (
            <LeaderboardTable rows={globalRows} currentUid={user?.uid} loading={loading} />
          ) : !user ? (
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 text-center">
              <Users className="h-9 w-9 text-cyan-400 mx-auto" />
              <h3 className="font-display text-lg font-bold text-white mt-3">
                Sign In to Connect with Friends
              </h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Link your Google account to get a shareable Friend Code, challenge friends on a private leaderboard, and sync high scores across devices.
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
          ) : (
            <div className="space-y-4">
              {/* Friend Code & Add Friend */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-400">Your Friend Code</div>
                    <div className="font-mono-num text-lg font-bold text-cyan-400 tracking-wider">
                      {myCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                <form onSubmit={handleAddFriend} className="flex gap-2">
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter friend code (e.g. A1B2C3D4)"
                    maxLength={12}
                    className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </form>

                {friendMsg && <div className="text-xs text-amber-300">{friendMsg}</div>}
              </div>

              {/* Incoming Requests */}
              {incomingRequests.length > 0 && (
                <div className="rounded-xl bg-slate-950 border border-amber-500/40 p-4 space-y-2.5">
                  <div className="text-xs font-semibold text-amber-300">
                    Incoming Friend Requests
                  </div>
                  {incomingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-white">{req.requesterName}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAccept(req.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRemove(req.id)}
                          aria-label="Decline friend request"
                          className="rounded-lg bg-slate-800 hover:bg-slate-700 p-1.5 text-slate-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <LeaderboardTable rows={friendRows} currentUid={user.uid} loading={loading} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LeaderboardTable({
  rows,
  currentUid,
  loading,
}: {
  rows: LeaderboardEntry[];
  currentUid?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        Loading leaderboard rankings...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-8 text-center text-sm text-slate-400">
        No runs recorded yet. Sign in with Google and complete a run to claim #1!
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-800 text-xs font-semibold text-slate-400">
        <div className="col-span-2">Rank</div>
        <div className="col-span-5">Runner</div>
        <div className="col-span-2 text-right">Dist</div>
        <div className="col-span-3 text-right">High Score</div>
      </div>
      <div className="divide-y divide-slate-800/70">
        {rows.map((row, idx) => {
          const isMe = row.userId === currentUid;
          const skin = getSkinById(row.equippedSkin);
          return (
            <div
              key={row.userId}
              className={`grid grid-cols-12 gap-2 items-center px-4 py-3 text-sm ${
                isMe ? 'bg-amber-500/10' : ''
              }`}
            >
              <div className="col-span-2 font-mono-num font-bold text-slate-300">
                #{idx + 1}
              </div>
              <div className="col-span-5 min-w-0">
                <div className="font-semibold text-white truncate">
                  {row.displayName} {isMe ? '(You)' : ''}
                </div>
                <div className="text-xs text-slate-400 truncate">{skin.name}</div>
              </div>
              <div className="col-span-2 text-right font-mono-num text-xs text-cyan-400">
                {row.bestDistance.toLocaleString()}m
              </div>
              <div className="col-span-3 text-right font-mono-num font-bold text-amber-400">
                {row.highScore.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

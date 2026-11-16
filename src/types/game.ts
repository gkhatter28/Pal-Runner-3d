export type QualityPreset = 'auto' | 'low' | 'high';

export type PowerUpType = 'jetpack' | 'magnet' | 'multiplier' | 'hoverboard';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'crashed';

export interface RunnerSkin {
  id: string;
  name: string;
  tagline: string;
  cost: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  skinTone: number;
  headwear: 'cap' | 'visor' | 'helmet' | 'beanie' | 'crown';
  trailHex: string;
  cardGradient: string;
  exclusiveIap?: boolean;
}

export const RUNNER_SKINS: RunnerSkin[] = [
  {
    id: 'street_kid',
    name: 'Street Kid',
    tagline: 'Cobalt hoodie & classic metro kicks',
    cost: 0,
    primaryColor: 0x2563eb,
    secondaryColor: 0x1e293b,
    accentColor: 0xf59e0b,
    skinTone: 0xf1c27d,
    headwear: 'cap',
    trailHex: '#38bdf8',
    cardGradient: 'from-blue-600/30 to-slate-900',
  },
  {
    id: 'volt_sprinter',
    name: 'Volt Sprinter',
    tagline: 'Graphite techwear & cyan optical visor',
    cost: 500,
    primaryColor: 0x0f172a,
    secondaryColor: 0x06b6d4,
    accentColor: 0x22d3ee,
    skinTone: 0xe0ac69,
    headwear: 'visor',
    trailHex: '#06b6d4',
    cardGradient: 'from-cyan-500/30 to-slate-900',
  },
  {
    id: 'solar_ace',
    name: 'Solar Ace',
    tagline: 'Sunset bomber jacket & amber aviators',
    cost: 1200,
    primaryColor: 0xea580c,
    secondaryColor: 0x451a03,
    accentColor: 0xfbbf24,
    skinTone: 0xc68642,
    headwear: 'helmet',
    trailHex: '#f59e0b',
    cardGradient: 'from-amber-500/30 to-slate-900',
  },
  {
    id: 'crimson_rebel',
    name: 'Crimson Rebel',
    tagline: 'Varsity crimson shell & charcoal beanie',
    cost: 2500,
    primaryColor: 0xdc2626,
    secondaryColor: 0x18181b,
    accentColor: 0xf87171,
    skinTone: 0xf1c27d,
    headwear: 'beanie',
    trailHex: '#ef4444',
    cardGradient: 'from-red-600/30 to-slate-900',
  },
  {
    id: 'jade_phantom',
    name: 'Jade Phantom',
    tagline: 'Emerald kinetic armor & titanium cowl',
    cost: 4000,
    primaryColor: 0x059669,
    secondaryColor: 0x064e3b,
    accentColor: 0x34d399,
    skinTone: 0x8d5524,
    headwear: 'visor',
    trailHex: '#10b981',
    cardGradient: 'from-emerald-500/30 to-slate-900',
  },
  {
    id: 'gold_sovereign',
    name: 'Gold Sovereign',
    tagline: 'Brushed gold exo-suit & platinum crest',
    cost: 8000,
    primaryColor: 0xd97706,
    secondaryColor: 0x1e1b4b,
    accentColor: 0xfde047,
    skinTone: 0xe0ac69,
    headwear: 'crown',
    trailHex: '#fbbf24',
    cardGradient: 'from-yellow-500/35 to-slate-900',
  },
];

export const PRIVACY_POLICY_URL =
  'https://ais-pre-dg6g25albs3wdll5nhiqt7-418457078286.asia-northeast1.run.app/privacy-policy.html';

export interface IAPProduct {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  priceLabel: string;
  hoverboardsAwarded: number;
  grantsAdFree?: boolean;
  unlocksSkinId?: string;
  featured?: boolean;
}

export const IAP_PRODUCTS: IAPProduct[] = [
  {
    id: 'starter_shields',
    name: 'Shield Supply Pack',
    description: '5 hoverboard shields for crash protection during high-speed runs.',
    priceCoins: 600,
    priceLabel: '600 Coins',
    hoverboardsAwarded: 5,
  },
  {
    id: 'ad_free_pass',
    name: 'Ad-Free Express Pass',
    description: 'Removes all post-run & banner ads permanently + instant revives + 5 shields.',
    priceCoins: 5000,
    priceLabel: '5,000 Coins',
    hoverboardsAwarded: 5,
    grantsAdFree: true,
    featured: true,
  },
  {
    id: 'pro_shields',
    name: 'Metro Shield Crate',
    description: '15 hoverboard shields for marathon leaderboard runs.',
    priceCoins: 1650,
    priceLabel: '1,650 Coins',
    hoverboardsAwarded: 15,
  },
  {
    id: 'sovereign_vault',
    name: 'Sovereign Vault Bundle',
    description: 'Unlocks Gold Sovereign skin + Ad-Free Express Pass + 20 hoverboard shields.',
    priceCoins: 11000,
    priceLabel: '11,000 Coins',
    hoverboardsAwarded: 20,
    grantsAdFree: true,
    unlocksSkinId: 'gold_sovereign',
  },
];

export interface PlayerSaveState {
  coins: number;
  highScore: number;
  bestDistance: number;
  totalRuns: number;
  ownedSkins: string[];
  equippedSkin: string;
  magnetLevel: number;
  jetpackLevel: number;
  multiplierLevel: number;
  hoverboards: number;
  adFree: boolean;
  personalizedAds: boolean;
  audioSfx: boolean;
  audioMusic: boolean;
  qualityPreset: QualityPreset;
  touchControls: boolean;
  purchases: string[];
  privacyConsent: boolean;
  privacyConsentAcknowledged?: boolean;
}

export const DEFAULT_SAVE_STATE: PlayerSaveState = {
  coins: 250,
  highScore: 0,
  bestDistance: 0,
  totalRuns: 0,
  ownedSkins: ['street_kid'],
  equippedSkin: 'street_kid',
  magnetLevel: 1,
  jetpackLevel: 1,
  multiplierLevel: 1,
  hoverboards: 2,
  adFree: false,
  personalizedAds: false,
  audioSfx: true,
  audioMusic: true,
  qualityPreset: 'auto',
  touchControls: false,
  purchases: [],
  privacyConsent: true,
  privacyConsentAcknowledged: false,
};

export interface ActivePowerUpTimers {
  jetpack: number;
  jetpackMax: number;
  magnet: number;
  magnetMax: number;
  multiplier: number;
  multiplierMax: number;
  hoverboardActive: boolean;
}

export interface LiveRunHUD {
  score: number;
  distance: number;
  runCoins: number;
  speed: number;
  multiplier: number;
  hoverboardsLeft: number;
  powerUps: ActivePowerUpTimers;
}

export interface RunSummary {
  score: number;
  distance: number;
  coinsEarned: number;
  isNewBest: boolean;
  revivedAlready: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  friendCode: string;
  equippedSkin: string;
  highScore: number;
  bestDistance: number;
  isPublic: boolean;
}

export interface FriendshipRecord {
  id: string;
  requesterId: string;
  targetId: string;
  requesterName: string;
  targetName: string;
  status: 'pending' | 'accepted';
}

export function clampInt(val: number, min: number, max: number): number {
  const n = Math.floor(Number.isFinite(val) ? val : min);
  return Math.max(min, Math.min(max, n));
}

export function sanitizeIdString(val: string, maxLen = 32): string {
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
  return cleaned || 'street_kid';
}

export function sanitizeDisplayName(val: string): string {
  const cleaned = val.trim().replace(/\s+/g, ' ').slice(0, 40);
  return cleaned || 'Pal Runner';
}

export function deriveFriendCode(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const padded = (clean + 'METRO88').slice(0, 8);
  return padded;
}

export function getSkinById(id: string): RunnerSkin {
  return RUNNER_SKINS.find((s) => s.id === id) ?? RUNNER_SKINS[0];
}

export function getPowerUpDuration(type: 'magnet' | 'jetpack' | 'multiplier', level: number): number {
  const lvl = clampInt(level, 1, 5);
  if (type === 'jetpack') return 6 + (lvl - 1) * 1.5;
  if (type === 'magnet') return 8 + (lvl - 1) * 2.0;
  return 10 + (lvl - 1) * 2.5;
}

export function getUpgradeCost(currentLevel: number): number {
  const costs = [0, 350, 800, 1600, 3000];
  return costs[currentLevel] ?? 9999;
}

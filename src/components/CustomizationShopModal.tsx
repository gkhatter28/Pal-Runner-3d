import { useState } from 'react';
import { X, Check, Lock, Zap, Magnet, Flame, Shield } from 'lucide-react';
import {
  RUNNER_SKINS,
  getPowerUpDuration,
  getUpgradeCost,
  type PlayerSaveState,
} from '../types/game';

interface CustomizationShopModalProps {
  save: PlayerSaveState;
  onClose: () => void;
  onSelectSkin: (skinId: string) => void;
  onBuySkin: (skinId: string, cost: number) => void;
  onUpgradePowerUp: (type: 'magnet' | 'jetpack' | 'multiplier', cost: number) => void;
  onBuyHoverboard: () => void;
}

export function CustomizationShopModal({
  save,
  onClose,
  onSelectSkin,
  onBuySkin,
  onUpgradePowerUp,
  onBuyHoverboard,
}: CustomizationShopModalProps) {
  const [tab, setTab] = useState<'skins' | 'upgrades'>('skins');

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-6">
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Runner Locker & Upgrades</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-num">
              Balance: <span className="text-amber-400 font-semibold">{save.coins.toLocaleString()} Coins</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close locker"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setTab('skins')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === 'skins' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Outfits & Skins
            </button>
            <button
              type="button"
              onClick={() => setTab('upgrades')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                tab === 'upgrades' ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              Power-Ups & Shields
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'skins' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {RUNNER_SKINS.map((skin) => {
                const owned = save.ownedSkins.includes(skin.id);
                const equipped = save.equippedSkin === skin.id;
                const canAfford = save.coins >= skin.cost;

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl bg-gradient-to-br ${skin.cardGradient} border p-4 flex flex-col justify-between gap-4 ${
                      equipped ? 'border-amber-400' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-sm border border-white/25"
                            style={{ backgroundColor: skin.trailHex }}
                          />
                          <h3 className="font-display text-base font-bold text-white">{skin.name}</h3>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{skin.tagline}</p>
                      </div>
                      <span className="text-xs font-mono-num text-slate-400 capitalize">
                        {skin.headwear}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      {equipped ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
                          <Check className="h-4 w-4" />
                          Equipped
                        </span>
                      ) : owned ? (
                        <button
                          type="button"
                          onClick={() => onSelectSkin(skin.id)}
                          className="rounded-lg bg-slate-100 hover:bg-white px-4 py-2 text-xs font-bold text-slate-950 transition-colors"
                        >
                          Equip Outfit
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuySkin(skin.id, skin.cost)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Unlock · {skin.cost.toLocaleString()}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <UpgradeRow
                icon={<Flame className="h-5 w-5 text-orange-400" />}
                title="Jetpack Boost"
                description={`Fly high above trains collecting sky coins (${getPowerUpDuration('jetpack', save.jetpackLevel).toFixed(1)}s duration)`}
                level={save.jetpackLevel}
                coins={save.coins}
                onUpgrade={() => onUpgradePowerUp('jetpack', getUpgradeCost(save.jetpackLevel))}
              />
              <UpgradeRow
                icon={<Magnet className="h-5 w-5 text-red-400" />}
                title="Coin Magnet"
                description={`Pull coins across all three lanes (${getPowerUpDuration('magnet', save.magnetLevel).toFixed(1)}s duration)`}
                level={save.magnetLevel}
                coins={save.coins}
                onUpgrade={() => onUpgradePowerUp('magnet', getUpgradeCost(save.magnetLevel))}
              />
              <UpgradeRow
                icon={<Zap className="h-5 w-5 text-purple-400" />}
                title="2x Score Multiplier"
                description={`Doubles distance & coin score (${getPowerUpDuration('multiplier', save.multiplierLevel).toFixed(1)}s duration)`}
                level={save.multiplierLevel}
                coins={save.coins}
                onUpgrade={() => onUpgradePowerUp('multiplier', getUpgradeCost(save.multiplierLevel))}
              />

              {/* Hoverboard Shield Refill */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 shrink-0">
                    <Shield className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">Hoverboard Shield</h3>
                      <span className="font-mono-num text-xs text-cyan-400">
                        Owned: {save.hoverboards}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Double-tap or press E mid-run to ride a hoverboard that absorbs 1 crash.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={save.coins < 150}
                  onClick={onBuyHoverboard}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    save.coins >= 150
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Buy +1 Shield · 150
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UpgradeRow({
  icon,
  title,
  description,
  level,
  coins,
  onUpgrade,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  level: number;
  coins: number;
  onUpgrade: () => void;
}) {
  const isMax = level >= 5;
  const cost = getUpgradeCost(level);
  const canAfford = coins >= cost;

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold text-white">{title}</h3>
            <span className="font-mono-num text-xs text-amber-400">Lv. {level}/5</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          <div className="mt-2 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className={`h-1.5 w-6 rounded-full ${
                  step <= level ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {isMax ? (
        <span className="text-xs font-bold text-emerald-400 px-3 py-2">Max Level</span>
      ) : (
        <button
          type="button"
          disabled={!canAfford}
          onClick={onUpgrade}
          className={`rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
            canAfford
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          Upgrade · {cost.toLocaleString()}
        </button>
      )}
    </div>
  );
}

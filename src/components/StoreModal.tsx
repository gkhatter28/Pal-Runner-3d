import { useState } from 'react';
import { X, ShoppingBag, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { IAP_PRODUCTS, type IAPProduct, type PlayerSaveState } from '../types/game';

interface StoreModalProps {
  save: PlayerSaveState;
  onClose: () => void;
  onPurchaseProduct: (product: IAPProduct) => void;
}

export function StoreModal({ save, onClose, onPurchaseProduct }: StoreModalProps) {
  const [confirmItem, setConfirmItem] = useState<IAPProduct | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleConfirmPurchase = () => {
    if (!confirmItem || save.coins < confirmItem.priceCoins) return;
    onPurchaseProduct(confirmItem);
    setSuccessMsg(`${confirmItem.name} unlocked and saved.`);
    setConfirmItem(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-slate-950/75 p-0 sm:p-6">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">Metro Supply Store</h2>
              <p className="text-xs text-slate-400 font-mono-num">
                Balance: <span className="text-amber-400 font-semibold">{save.coins.toLocaleString()} Coins</span> · Unlock passes &amp; shields with earned Coins
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close store"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {save.adFree && (
            <div className="flex items-center gap-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-3 text-xs text-cyan-200">
              <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Ad-Free Express Pass is active on your account. Post-run revives are instant.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {IAP_PRODUCTS.map((product) => {
              const alreadyOwnsAdFree = Boolean(
                product.id === 'ad_free_pass' && save.adFree,
              );
              const alreadyOwnsSovereign = Boolean(
                product.id === 'sovereign_vault' &&
                  save.adFree &&
                  save.ownedSkins.includes('gold_sovereign'),
              );
              const owned = alreadyOwnsAdFree || alreadyOwnsSovereign;
              const canAfford = save.coins >= product.priceCoins;

              return (
                <div
                  key={product.id}
                  className={`rounded-xl bg-slate-950 border p-4 flex flex-col justify-between gap-4 ${
                    product.featured ? 'border-amber-500/60' : 'border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-white">
                        {product.name}
                      </h3>
                      {product.featured && (
                        <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                    <span className="font-mono-num text-sm font-bold text-amber-400">
                      {product.priceLabel}
                    </span>

                    {owned ? (
                      <span className="text-xs font-bold text-emerald-400">Owned</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => setConfirmItem(product)}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                          canAfford
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coin Unlock Confirmation Dialog */}
      {confirmItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl">
            <div className="text-xs font-medium text-amber-400">Metro Supply Unlock</div>
            <h3 className="font-display text-xl font-bold text-white mt-1">
              {confirmItem.name}
            </h3>
            <p className="text-sm text-slate-300 mt-2">{confirmItem.description}</p>
            <div className="mt-4 rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">Cost</span>
              <span className="font-mono-num font-bold text-amber-400">{confirmItem.priceLabel}</span>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchase}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950"
              >
                Confirm Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { ArrowDownUp, Loader2, TrendingUp, CheckCircle, ArrowDown } from 'lucide-react';
import { useIdentity, useAssets, useTransfer } from '@/sdk';
import { CurrencyUtils } from '@/sdk';
import { BaseModal, ModalHeader, Button } from '@/components/ui';

type Step = 'swap' | 'processing' | 'success';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SwapModal({ isOpen, onClose }: SwapModalProps) {
  const { nametag } = useIdentity();
  const { assets } = useAssets();
  const { transfer } = useTransfer();

  const [step, setStep] = useState<Step>('swap');
  const [fromAsset, setFromAsset] = useState<any>(null);
  const [toAsset, setToAsset] = useState<any>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use user's assets as available swap options
  const swappableAssets = useMemo(() => assets, [assets]);

  // Format asset amount from smallest unit to human-readable
  const formatAssetAmount = (asset: any): string => {
    try {
      return CurrencyUtils.toHumanReadable(asset.totalAmount, asset.decimals);
    } catch {
      return '0';
    }
  };

  const resolvePrice = (asset: any): number => {
    return asset.priceUsd && asset.priceUsd > 0 ? asset.priceUsd : 1.0;
  };

  const exchangeInfo = useMemo(() => {
    if (!fromAsset || !toAsset || !fromAmount || parseFloat(fromAmount) <= 0) return null;
    const fromAmountNum = parseFloat(fromAmount);
    const fromPrice = resolvePrice(fromAsset);
    const toPrice = resolvePrice(toAsset);
    if (fromPrice === 0 || toPrice === 0) return null;
    const rate = fromPrice / toPrice;
    const toAmount = fromAmountNum * rate;
    return { rate, fromValueUSD: fromAmountNum * fromPrice, toAmount, toValueUSD: toAmount * toPrice };
  }, [fromAsset, toAsset, fromAmount]);

  const isValidAmount = useMemo(() => {
    if (!fromAsset || !fromAmount) return false;
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) return false;
    const maxAmount = parseFloat(formatAssetAmount(fromAsset));
    return amount <= maxAmount;
  }, [fromAsset, fromAmount]);

  const reset = () => {
    setStep('swap');
    setFromAsset(null);
    setToAsset(null);
    setFromAmount('');
    setError(null);
    setShowFromDropdown(false);
    setShowToDropdown(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSwap = async () => {
    if (!fromAsset || !toAsset || !fromAmount || !exchangeInfo || !nametag) return;
    setStep('processing');
    setError(null);
    try {
      const fromAmountSmallest = CurrencyUtils.toSmallestUnit(fromAmount, fromAsset.decimals);
      await transfer({ recipient: 'swap', amount: fromAmountSmallest.toString(), coinId: fromAsset.coinId });
      // Request swapped tokens from faucet
      const coinName = (toAsset.name || toAsset.symbol || '').toLowerCase();
      await fetch(`https://faucet.unicity.network/api/faucet/request?nametag=${encodeURIComponent(nametag)}&coin=${encodeURIComponent(coinName)}&amount=${exchangeInfo.toAmount}`);
      setStep('success');
    } catch (e: unknown) {
      console.error('Swap failed:', e);
      setError(e instanceof Error ? e.message : 'Swap failed');
      setStep('swap');
    }
  };

  const handleFlipAssets = () => {
    if (!fromAsset || !toAsset) return;
    const newFrom = assets.find((a: any) => a.coinId === toAsset.coinId);
    if (!newFrom) {
      setError(`You don't have any ${toAsset.symbol} to swap from`);
      return;
    }
    const newTo = swappableAssets.find((a: any) => a.coinId === fromAsset.coinId);
    setFromAsset(newFrom);
    setToAsset(newTo || fromAsset);
    setError(null);
    if (exchangeInfo && exchangeInfo.toAmount > 0) {
      setFromAmount(parseFloat(exchangeInfo.toAmount.toFixed(6)).toString());
    } else {
      setFromAmount('');
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'swap': return 'Swap Tokens';
      case 'processing': return 'Processing Swap...';
      case 'success': return 'Swap Complete!';
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} showOrbs={false}>
      <ModalHeader title={getTitle()} onClose={handleClose} />

      <div className="p-6 flex-1 min-h-0 overflow-y-auto">
        {/* SWAP INTERFACE */}
        {step === 'swap' && (
          <div>
            {/* FROM */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">From</span>
                {fromAsset && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate ml-2">
                    Balance: <span className="text-neutral-900 dark:text-white">{formatAssetAmount(fromAsset)}</span>
                  </span>
                )}
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <button
                      onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
                      className="flex items-center gap-1.5 px-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors whitespace-nowrap"
                    >
                      {fromAsset ? (
                        <>
                          {fromAsset.iconUrl && <img src={fromAsset.iconUrl} className="w-5 h-5 rounded-full shrink-0" alt="" />}
                          <span className="text-neutral-900 dark:text-white font-medium text-sm">{fromAsset.symbol}</span>
                        </>
                      ) : (
                        <span className="text-neutral-500 text-sm">Select</span>
                      )}
                      <ArrowDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    </button>
                    {showFromDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {assets.map((asset: any) => (
                          <button
                            key={asset.coinId}
                            onClick={() => { setFromAsset(asset); setShowFromDropdown(false); setFromAmount(''); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-left"
                          >
                            {asset.iconUrl && <img src={asset.iconUrl} className="w-6 h-6 rounded-full" alt="" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-neutral-900 dark:text-white font-medium text-sm truncate">{asset.symbol}</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{formatAssetAmount(asset)}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!fromAsset}
                    className="flex-1 bg-transparent text-right text-xl font-mono text-neutral-900 dark:text-white outline-none disabled:opacity-50 min-w-0"
                  />
                </div>
                {fromAsset && fromAmount && (
                  <div className="mt-2 text-right text-xs text-neutral-500 dark:text-neutral-400">
                    ≈ ${(parseFloat(fromAmount) * resolvePrice(fromAsset)).toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Flip */}
            <div className="flex justify-center items-center mt-4 mb-1 relative z-10">
              <button onClick={handleFlipAssets} className="p-2 bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-700 rounded-full hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <ArrowDownUp className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              </button>
            </div>

            {/* TO */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">To</span>
              </div>
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <button
                      onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
                      className="flex items-center gap-1.5 px-2 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors whitespace-nowrap"
                    >
                      {toAsset ? (
                        <>
                          {toAsset.iconUrl && <img src={toAsset.iconUrl} className="w-5 h-5 rounded-full shrink-0" alt="" />}
                          <span className="text-neutral-900 dark:text-white font-medium text-sm">{toAsset.symbol}</span>
                        </>
                      ) : (
                        <span className="text-neutral-500 text-sm">Select</span>
                      )}
                      <ArrowDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    </button>
                    {showToDropdown && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {swappableAssets.filter((a: any) => a.coinId !== fromAsset?.coinId).map((asset: any) => (
                          <button
                            key={asset.coinId}
                            onClick={() => { setToAsset(asset); setShowToDropdown(false); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-left"
                          >
                            {asset.iconUrl && <img src={asset.iconUrl} className="w-6 h-6 rounded-full" alt="" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-neutral-900 dark:text-white font-medium text-sm truncate">{asset.symbol}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-right text-xl font-mono text-neutral-900 dark:text-white break-all min-w-0">
                    {exchangeInfo ? exchangeInfo.toAmount.toFixed(6) : '0.00'}
                  </div>
                </div>
                {exchangeInfo && (
                  <div className="mt-2 text-right text-xs text-neutral-500 dark:text-neutral-400">
                    ≈ ${exchangeInfo.toValueUSD.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* Exchange Rate */}
            {exchangeInfo && fromAsset && toAsset && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Exchange Rate</span>
                </div>
                <div className="text-sm text-neutral-700 dark:text-neutral-300">
                  1 {fromAsset.symbol} = {exchangeInfo.rate.toFixed(6)} {toAsset.symbol}
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button onClick={handleSwap} disabled={!isValidAmount || !toAsset || !exchangeInfo} icon={ArrowDownUp} fullWidth>
              Swap Tokens
            </Button>
          </div>
        )}

        {/* PROCESSING */}
        {step === 'processing' && (
          <div className="py-10 text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <h3 className="text-neutral-900 dark:text-white font-medium text-lg">Processing Swap...</h3>
            <p className="text-neutral-500 text-sm mt-2">Sending tokens and requesting swap</p>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && fromAsset && toAsset && exchangeInfo && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-neutral-900 dark:text-white font-bold text-2xl mb-2">Swap Complete!</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-1">
              Swapped <b>{fromAmount} {fromAsset.symbol}</b>
            </p>
            <p className="text-neutral-500 dark:text-neutral-400">
              for <b>{exchangeInfo.toAmount.toFixed(6)} {toAsset.symbol}</b>
            </p>
            <button
              onClick={handleClose}
              className="mt-8 px-8 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

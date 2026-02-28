import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowRight, Loader2, User, CheckCircle, Coins, Hash, Copy, Check } from 'lucide-react';
import type { Asset } from '@unicitylabs/sphere-sdk';
import { useAssets, useTransfer, useSphereContext, CurrencyUtils } from '@/sdk';
import { getErrorMessage } from '@/sdk/errors';
import { BaseModal, ModalHeader, Button } from '@/components/ui';

type Step = 'recipient' | 'asset' | 'amount' | 'confirm' | 'processing' | 'success';

export interface SendPrefill {
  to: string;
  amount: string;
  coinId: string;
  memo?: string;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: (result?: { success: boolean }) => void;
  prefill?: SendPrefill;
}

export function SendModal({ isOpen, onClose, prefill }: SendModalProps) {
  const { assets } = useAssets();
  const { transfer, isLoading: isTransferring } = useTransfer();
  const ctx = useSphereContext();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => {});
  }, []);

  // State
  const [step, setStep] = useState<Step>('recipient');
  const [recipientMode, setRecipientMode] = useState<'nametag' | 'direct'>('nametag');
  const [recipient, setRecipient] = useState('');
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [memoInput, setMemoInput] = useState('');

  // Pre-fill from connect intent (dApp request)
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!prefill || !isOpen || prefillApplied.current) return;
    if (assets.length === 0) return; // wait for assets to load

    const { to, amount, coinId } = prefill;

    if (to.startsWith('DIRECT://')) {
      setRecipientMode('direct');
      setRecipient(to);
    } else {
      setRecipientMode('nametag');
      setRecipient(to.replace(/^@/, ''));
    }

    setAmountInput(amount);
    if (prefill.memo) setMemoInput(prefill.memo);

    const asset = assets.find((a) => a.coinId === coinId);
    if (asset) {
      setSelectedAsset(asset);
      setStep('confirm');
      prefillApplied.current = true;
    }
  }, [prefill, isOpen, assets]);

  const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (recipientMode === 'nametag') {
      const value = e.target.value.toLowerCase();
      if (/^@?[a-z0-9_\-+.]*$/.test(value)) {
        setRecipient(value);
        setRecipientError(null);
      }
    } else {
      setRecipient(e.target.value);
      setRecipientError(null);
    }
  };

  const reset = () => {
    setStep('recipient');
    setRecipientMode('nametag');
    setRecipient('');
    setResolvedAddress(null);
    setSelectedAsset(null);
    setAmountInput('');
    setMemoInput('');
    setRecipientError(null);
    prefillApplied.current = false;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // STEP 1: Validate Recipient via SDK transport
  const handleRecipientNext = async () => {
    if (!recipient.trim()) return;
    setIsCheckingRecipient(true);
    setRecipientError(null);

    try {
      if (recipientMode === 'direct') {
        const addr = recipient.trim();
        if (!addr.startsWith('DIRECT://')) {
          setRecipientError('Direct address must start with DIRECT://');
          return;
        }
        setRecipient(addr);
        setResolvedAddress(addr);
        setStep('asset');
      } else {
        const cleanTag = recipient.replace('@', '').replace('@unicity', '').trim();

        if (ctx.resolve) {
          const peerInfo = await ctx.resolve(`@${cleanTag}`);
          if (peerInfo) {
            setRecipient(cleanTag);
            setResolvedAddress(peerInfo.proxyAddress || null);
            setStep('asset');
          } else {
            setRecipientError(`User @${cleanTag} not found`);
          }
        } else {
          setRecipient(cleanTag);
          setStep('asset');
        }
      }
    } catch {
      setRecipientError("Network error");
    } finally {
      setIsCheckingRecipient(false);
    }
  };

  // STEP 3: Go to confirm
  const handleAmountNext = () => {
    if (!selectedAsset || !amountInput) return;
    const targetAmount = CurrencyUtils.toSmallestUnit(amountInput, selectedAsset.decimals);
    if (targetAmount === '0') return;
    setStep('confirm');
  };

  // STEP 4: Execute transfer via SDK
  const handleSend = async () => {
    if (!selectedAsset || !amountInput || !recipient) return;

    setStep('processing');
    setRecipientError(null);

    try {
      const amount = CurrencyUtils.toSmallestUnit(amountInput, selectedAsset.decimals);
      await transfer({
        coinId: selectedAsset.coinId,
        amount,
        recipient,
        ...(memoInput ? { memo: memoInput } : {}),
      });

      setStep('success');
    } catch (e: unknown) {
      console.error(e);
      setRecipientError(getErrorMessage(e));
      setStep('confirm');
    }
  };

  const handleSuccessClose = () => {
    reset();
    onClose({ success: true });
  };

  const getTitle = () => {
    switch (step) {
      case 'recipient': return 'Send To';
      case 'asset': return 'Select Asset';
      case 'amount': return 'Enter Amount';
      case 'confirm': return 'Confirm Transfer';
      case 'processing': return 'Processing...';
      case 'success': return 'Sent!';
    }
  };

  const formatAmount = (rawAmount: string, decimals: number) =>
    CurrencyUtils.toHumanReadable(rawAmount, decimals);

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} showOrbs={false}>
      <ModalHeader title={getTitle()} onClose={handleClose} />

      <div className="px-6 py-3 flex-1 flex flex-col justify-center overflow-y-auto">

        {/* 1. RECIPIENT */}
        {step === 'recipient' && (
          <div>
            <div className="mb-6">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">
                {recipientMode === 'nametag' ? 'Unicity Nametag' : 'Direct Address'}
              </label>
              <div className="relative">
                {recipientMode === 'nametag' && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500">@</span>
                )}
                <input
                  autoFocus
                  value={recipient}
                  onChange={handleRecipientChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecipientNext()}
                  className={`w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-3 pr-4 text-neutral-900 dark:text-white focus:border-orange-500 outline-none ${recipientMode === 'nametag' ? 'pl-8' : 'pl-4 font-mono text-sm'}`}
                  placeholder={recipientMode === 'nametag' ? 'Unicity ID' : 'DIRECT://...'}
                />
              </div>
              {recipientError && <p className="text-red-500 text-sm mt-2">{recipientError}</p>}
              <button
                onClick={() => { setRecipientMode(recipientMode === 'nametag' ? 'direct' : 'nametag'); setRecipient(''); setRecipientError(null); }}
                className="text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-orange-500 dark:hover:text-orange-400 mt-2 transition-colors"
              >
                {recipientMode === 'nametag' ? 'Use direct address instead' : 'Use nametag instead'}
              </button>
            </div>

            <Button
              onClick={handleRecipientNext}
              disabled={!recipient || isCheckingRecipient}
              loading={isCheckingRecipient}
              loadingText="Checking..."
              icon={ArrowRight}
              iconPosition="right"
              fullWidth
            >
              Continue
            </Button>
          </div>
        )}

        {/* 2. ASSET */}
        {step === 'asset' && (
          <div className="space-y-2">
            {assets.map((asset) => (
              <button
                key={asset.coinId}
                onClick={() => { setSelectedAsset(asset); setStep('amount'); }}
                className="w-full p-3 flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-white/5 rounded-xl transition-colors text-left"
              >
                <img src={asset.iconUrl || ''} className="w-8 h-8 rounded-full" alt="" />
                <div className="flex-1">
                  <div className="text-neutral-900 dark:text-white font-medium">{asset.symbol}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">{formatAmount(asset.totalAmount, asset.decimals)} available</div>
                </div>
                <ArrowRight className="w-4 h-4 text-neutral-400 dark:text-neutral-600" />
              </button>
            ))}
          </div>
        )}

        {/* 3. AMOUNT */}
        {step === 'amount' && selectedAsset && (() => {
          const smallestUnit = CurrencyUtils.toSmallestUnit(amountInput || '0', selectedAsset.decimals);
          const insufficientBalance = amountInput !== '' && BigInt(smallestUnit) > BigInt(selectedAsset.totalAmount);
          return (
          <div>
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-500 dark:text-neutral-400">Amount</span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Available: <span className="text-neutral-900 dark:text-white">{formatAmount(selectedAsset.totalAmount, selectedAsset.decimals)}</span>
                </span>
              </div>
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmountInput(v);
                  }}
                  className={`w-full bg-neutral-100 dark:bg-neutral-900 border rounded-xl py-3 px-4 text-neutral-900 dark:text-white text-2xl font-mono outline-none ${insufficientBalance ? 'border-red-500 focus:border-red-500' : 'border-neutral-200 dark:border-white/10 focus:border-orange-500'}`}
                  placeholder="0.00"
                />
                <button
                  onClick={() => setAmountInput(formatAmount(selectedAsset.totalAmount, selectedAsset.decimals))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-neutral-200 dark:bg-neutral-800 text-orange-500 dark:text-orange-400 px-2 py-1 rounded hover:bg-neutral-300 dark:hover:bg-neutral-700"
                >
                  MAX
                </button>
              </div>
              {insufficientBalance && <p className="text-red-500 text-sm mt-2">Insufficient balance</p>}
              {recipientError && <p className="text-red-500 text-sm mt-2">{recipientError}</p>}
            </div>
            <div className="mb-6">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">Memo (optional)</label>
              <input
                type="text"
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-3 px-4 text-neutral-900 dark:text-white outline-none focus:border-orange-500 text-sm"
                placeholder="Add a note to this transfer"
              />
            </div>
            <Button
              onClick={handleAmountNext}
              disabled={!amountInput || insufficientBalance}
              fullWidth
            >
              Review
            </Button>
          </div>
          );
        })()}

        {/* 4. CONFIRM */}
        {step === 'confirm' && selectedAsset && (
          <div>

            {/* Summary Card */}
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 mb-6 border border-neutral-200 dark:border-white/10 text-center">
              <div className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">You are sending</div>
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">
                {amountInput} <span className="text-orange-500">{selectedAsset.symbol}</span>
              </div>
              {selectedAsset.priceUsd != null && (
                <div className="text-xs text-neutral-400 dark:text-neutral-500 mb-3">
                  &#8776; ${(parseFloat(amountInput) * selectedAsset.priceUsd).toFixed(2)} USD
                </div>
              )}
              {selectedAsset.priceUsd == null && <div className="mb-4" />}

              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-2 text-sm bg-neutral-200 dark:bg-neutral-800/50 p-2 rounded-lg">
                    {recipientMode === 'direct' ? (
                      <Hash className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                    ) : (
                      <User className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                    )}
                    <span className={`text-neutral-700 dark:text-neutral-300 ${recipientMode === 'direct' ? 'font-mono text-xs break-all' : ''}`}>
                      {recipientMode === 'direct' ? recipient : `@${recipient}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(
                      recipientMode === 'direct' ? recipient : `@${recipient}`,
                      'recipient'
                    )}
                    className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    title="Copy"
                  >
                    {copiedKey === 'recipient'
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    }
                  </button>
                </div>
                {recipientMode === 'nametag' && resolvedAddress && (
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] font-mono text-neutral-400/40 dark:text-neutral-600/50 truncate max-w-52"
                      title={resolvedAddress}
                    >
                      {resolvedAddress.length > 30
                        ? `${resolvedAddress.slice(0, 18)}...${resolvedAddress.slice(-8)}`
                        : resolvedAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resolvedAddress, 'address')}
                      className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                      title="Copy address"
                    >
                      {copiedKey === 'address'
                        ? <Check className="w-3 h-3 text-emerald-500" />
                        : <Copy className="w-3 h-3 text-neutral-500/40" />
                      }
                    </button>
                  </div>
                )}
              </div>
              {memoInput && (
                <div className="text-sm text-neutral-300 dark:text-neutral-400 mt-3 italic">
                  &ldquo;{memoInput}&rdquo;
                </div>
              )}
            </div>

            {/* Strategy Info */}
            <div className="mb-6 space-y-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                <Coins className="w-5 h-5 text-emerald-500 dark:text-emerald-400 mt-0.5" />
                <div>
                  <div className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Smart Transfer</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Token splitting and transfer optimization is handled automatically.
                  </div>
                </div>
              </div>
            </div>

            {recipientError && <p className="text-red-500 text-sm mb-4 text-center">{recipientError}</p>}

            <button
              onClick={handleSend}
              disabled={isTransferring}
              className="w-full py-3 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              Confirm & Send
            </button>
          </div>
        )}

        {/* 5. PROCESSING */}
        {step === 'processing' && (
          <div className="py-10 text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <h3 className="text-neutral-900 dark:text-white font-medium text-lg">Sending Transaction...</h3>
            <p className="text-neutral-500 text-sm mt-2">Processing proofs and broadcasting via Nostr</p>
          </div>
        )}

        {/* 6. SUCCESS */}
        {step === 'success' && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-neutral-900 dark:text-white font-bold text-2xl mb-2">Success!</h3>
            <p className="text-neutral-500 dark:text-neutral-400">
              Successfully sent <b>{amountInput} {selectedAsset?.symbol}</b> to <b>{recipientMode === 'direct' ? recipient : `@${recipient}`}</b>
            </p>
            <button onClick={handleSuccessClose} className="mt-8 px-8 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white transition-colors">
              Close
            </button>
          </div>
        )}

      </div>
    </BaseModal>
  );
}

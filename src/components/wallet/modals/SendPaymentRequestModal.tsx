/**
 * SendPaymentRequestModal — sends a payment request to another user via Nostr.
 *
 * Used both standalone (from wallet UI) and as a Connect protocol intent handler
 * when a dApp calls client.intent('payment_request', { to, amount, coinId, message }).
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, User, CheckCircle, Hash, Receipt } from 'lucide-react';
import { TokenRegistry, toSmallestUnit } from '@unicitylabs/sphere-sdk';
import { BaseModal, ModalHeader, Button } from '@/components/ui';
import { POPUP_MESSAGES } from '@/shared/messages';
import { getErrorMessage } from '@/sdk/errors';

type Step = 'recipient' | 'coin' | 'amount' | 'confirm' | 'processing' | 'success';

interface CoinOption {
  coinId: string;
  symbol: string;
  decimals: number;
  iconUrl?: string;
}

export interface PaymentRequestPrefill {
  to: string;
  amount: string;
  coinId: string;
  message?: string;
}

interface SendPaymentRequestModalProps {
  isOpen: boolean;
  onClose: (result?: { success: boolean; requestId?: string }) => void;
  prefill?: PaymentRequestPrefill;
}

export function SendPaymentRequestModal({ isOpen, onClose, prefill }: SendPaymentRequestModalProps) {
  const [step, setStep] = useState<Step>('recipient');
  const [recipientMode, setRecipientMode] = useState<'nametag' | 'direct'>('nametag');
  const [recipient, setRecipient] = useState('');
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [availableCoins, setAvailableCoins] = useState<CoinOption[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<CoinOption | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const registry = TokenRegistry.getInstance();
    const definitions = registry.getAllDefinitions();
    const coins: CoinOption[] = definitions
      .filter((def) => def.assetKind === 'fungible')
      .map((def) => ({
        coinId: def.id,
        symbol: def.symbol || def.name.toUpperCase(),
        decimals: def.decimals || 0,
        iconUrl: registry.getIconUrl(def.id) ?? undefined,
      }));
    setAvailableCoins(coins);
  }, [isOpen]);

  const prefillApplied = useRef(false);
  useEffect(() => {
    if (!prefill || !isOpen || prefillApplied.current) return;
    if (availableCoins.length === 0) return;

    const { to, amount, coinId, message } = prefill;
    if (to.startsWith('DIRECT://')) {
      setRecipientMode('direct');
      setRecipient(to);
    } else {
      setRecipientMode('nametag');
      setRecipient(to.replace(/^@/, ''));
    }
    setAmountInput(amount);
    if (message) setMessageInput(message);

    const coin = availableCoins.find((c) => c.coinId === coinId);
    if (coin) {
      setSelectedCoin(coin);
      setStep('confirm');
      prefillApplied.current = true;
    }
  }, [prefill, isOpen, availableCoins]);

  const reset = () => {
    setStep('recipient');
    setRecipientMode('nametag');
    setRecipient('');
    setSelectedCoin(null);
    setAmountInput('');
    setMessageInput('');
    setRecipientError(null);
    setError(null);
    setRequestId(null);
    prefillApplied.current = false;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleRecipientNext = async () => {
    if (!recipient.trim()) return;
    setIsCheckingRecipient(true);
    setRecipientError(null);
    try {
      if (recipientMode === 'direct') {
        if (!recipient.trim().startsWith('DIRECT://')) {
          setRecipientError('Direct address must start with DIRECT://');
          return;
        }
        setStep('coin');
      } else {
        const cleanTag = recipient.replace('@', '').replace('@unicity', '').trim();
        setRecipient(cleanTag);
        setStep('coin');
      }
    } catch {
      setRecipientError('Network error');
    } finally {
      setIsCheckingRecipient(false);
    }
  };

  const handleAmountNext = () => {
    if (!selectedCoin || !amountInput) return;
    const targetAmount = toSmallestUnit(amountInput, selectedCoin.decimals);
    if (targetAmount <= 0n) return;
    setStep('confirm');
  };

  const handleSendRequest = async () => {
    if (!selectedCoin || !amountInput || !recipient) return;
    setStep('processing');
    setError(null);
    try {
      const amount = toSmallestUnit(amountInput, selectedCoin.decimals).toString();
      const recipientStr = recipientMode === 'nametag' ? `@${recipient}` : recipient;
      const result = await chrome.runtime.sendMessage({
        type: POPUP_MESSAGES.SEND_PAYMENT_REQUEST,
        recipient: recipientStr,
        amount,
        coinId: selectedCoin.coinId,
        message: messageInput || undefined,
      });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to send payment request');
      }
      setRequestId(result.requestId || null);
      setStep('success');
    } catch (e: unknown) {
      setError(getErrorMessage(e));
      setStep('confirm');
    }
  };

  const handleSuccessClose = () => {
    reset();
    onClose({ success: true, requestId: requestId || undefined });
  };

  const getTitle = () => {
    switch (step) {
      case 'recipient': return 'Request From';
      case 'coin': return 'Select Currency';
      case 'amount': return 'Enter Amount';
      case 'confirm': return 'Confirm Request';
      case 'processing': return 'Sending...';
      case 'success': return 'Request Sent!';
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} size="sm">
      <ModalHeader title={getTitle()} onClose={handleClose} />

      <div className="p-4 flex-1 flex flex-col justify-center overflow-y-auto">

        {/* RECIPIENT */}
        {step === 'recipient' && (
          <div>
            <div className="mb-4">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">
                {recipientMode === 'nametag' ? 'Who should pay you?' : 'Direct Address'}
              </label>
              <div className="relative">
                {recipientMode === 'nametag' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">@</span>
                )}
                <input
                  autoFocus
                  value={recipient}
                  onChange={(e) => { setRecipient(e.target.value); setRecipientError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleRecipientNext()}
                  className={`w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-2.5 pr-4 text-neutral-900 dark:text-white focus:border-orange-500 outline-none text-sm ${recipientMode === 'nametag' ? 'pl-7' : 'pl-3 font-mono'}`}
                  placeholder={recipientMode === 'nametag' ? 'username' : 'DIRECT://...'}
                />
              </div>
              {recipientError && <p className="text-red-500 text-xs mt-1">{recipientError}</p>}
              <button
                onClick={() => { setRecipientMode(recipientMode === 'nametag' ? 'direct' : 'nametag'); setRecipient(''); setRecipientError(null); }}
                className="text-xs text-neutral-400 hover:text-orange-500 mt-1.5 transition-colors"
              >
                {recipientMode === 'nametag' ? 'Use direct address' : 'Use nametag'}
              </button>
            </div>
            <Button onClick={handleRecipientNext} disabled={!recipient || isCheckingRecipient} loading={isCheckingRecipient} fullWidth>
              Continue <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        )}

        {/* COIN */}
        {step === 'coin' && (
          <div className="space-y-2">
            {availableCoins.map((coin) => (
              <button
                key={coin.coinId}
                onClick={() => { setSelectedCoin(coin); setStep('amount'); }}
                className="w-full p-3 flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-white/5 rounded-xl transition-colors text-left"
              >
                {coin.iconUrl ? (
                  <img src={coin.iconUrl} className="w-8 h-8 rounded-full" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-500">
                    {coin.symbol.slice(0, 2)}
                  </div>
                )}
                <span className="text-sm font-medium text-neutral-900 dark:text-white">{coin.symbol}</span>
                <ArrowRight size={14} className="ml-auto text-neutral-400" />
              </button>
            ))}
          </div>
        )}

        {/* AMOUNT */}
        {step === 'amount' && selectedCoin && (
          <div>
            <div className="mb-4">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">Amount ({selectedCoin.symbol})</label>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmountInput(v); }}
                className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-3 px-4 text-neutral-900 dark:text-white text-2xl font-mono outline-none focus:border-orange-500"
                placeholder="0.00"
              />
            </div>
            <div className="mb-4">
              <label className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">Message (optional)</label>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-neutral-900 dark:text-white outline-none focus:border-orange-500 text-sm"
                placeholder="e.g. Payment for order #1234"
              />
            </div>
            <Button onClick={handleAmountNext} disabled={!amountInput} fullWidth>Review</Button>
          </div>
        )}

        {/* CONFIRM */}
        {step === 'confirm' && selectedCoin && (
          <div>
            <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl p-4 mb-4 border border-neutral-200 dark:border-white/10 text-center">
              <div className="text-xs text-neutral-500 mb-1">You are requesting</div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">
                {amountInput} <span className="text-orange-500">{selectedCoin.symbol}</span>
              </div>
              <div className="text-xs text-neutral-500 mb-1">from</div>
              <div className="flex items-center justify-center gap-2 text-sm bg-neutral-200 dark:bg-neutral-800/50 p-2 rounded-lg mx-auto max-w-max">
                {recipientMode === 'direct' ? (
                  <Hash size={14} className="text-neutral-500" />
                ) : (
                  <User size={14} className="text-neutral-500" />
                )}
                <span className={`text-neutral-700 dark:text-neutral-300 ${recipientMode === 'direct' ? 'font-mono text-xs break-all' : ''}`}>
                  {recipientMode === 'direct' ? recipient : `@${recipient}`}
                </span>
              </div>
              {messageInput && (
                <div className="text-xs text-neutral-400 mt-2 italic">&ldquo;{messageInput}&rdquo;</div>
              )}
            </div>

            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2">
              <Receipt size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <div className="text-blue-600 dark:text-blue-400 text-xs font-medium">Payment Request</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  The recipient will receive a notification and can choose to pay or decline.
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
            <Button onClick={handleSendRequest} fullWidth>Send Request</Button>
          </div>
        )}

        {/* PROCESSING */}
        {step === 'processing' && (
          <div className="py-10 text-center">
            <Loader2 size={40} className="text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-neutral-900 dark:text-white font-medium">Sending Payment Request...</p>
            <p className="text-neutral-500 text-sm mt-1">Delivering via Nostr</p>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && selectedCoin && (
          <div className="py-8 text-center">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <p className="text-neutral-900 dark:text-white font-bold text-xl mb-2">Request Sent!</p>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Payment request for <b>{amountInput} {selectedCoin.symbol}</b> sent to{' '}
              <b>{recipientMode === 'direct' ? recipient : `@${recipient}`}</b>
            </p>
            <button
              onClick={handleSuccessClose}
              className="mt-6 px-6 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white transition-colors text-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

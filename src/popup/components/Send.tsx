/**
 * Send view - send tokens to a recipient (address or nametag).
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';
import { ALPHA_COIN_ID, DEFAULT_COIN_SYMBOL, COIN_DECIMALS, DEFAULT_DECIMALS, formatTokenAmount } from '@/shared/constants';

export function Send() {
  const { balances, setView, loading } = useStore();
  const { sendTokens, resolveNametag } = useWallet();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Get primary balance (first balance or one matching ALPHA_COIN_ID)
  const primaryBalance = balances.find((b) => b.coinId === ALPHA_COIN_ID) || balances[0];
  const coinId = primaryBalance?.coinId || ALPHA_COIN_ID;
  const maxAmountRaw = primaryBalance?.amount || '0';
  const symbol = primaryBalance?.symbol || DEFAULT_COIN_SYMBOL;
  const decimals = COIN_DECIMALS[coinId] ?? DEFAULT_DECIMALS;

  // Format max amount for display
  const maxAmountFormatted = formatTokenAmount(maxAmountRaw, coinId);

  const formatBalance = (amt: string, cid: string): string => {
    const formatted = formatTokenAmount(amt, cid);
    const num = parseFloat(formatted);
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  // Resolve nametag when recipient changes
  useEffect(() => {
    const cleanRecipient = recipient.trim();

    if (!cleanRecipient) {
      setResolvedAddress(null);
      setError(null);
      return;
    }

    // If it's a hex address, no resolution needed
    if (/^[0-9a-fA-F]{32,}$/.test(cleanRecipient)) {
      setResolvedAddress(null);
      setError(null);
      return;
    }

    // Debounce nametag resolution
    const timer = setTimeout(async () => {
      setIsResolving(true);
      setError(null);

      const nametag = cleanRecipient.replace('@', '');
      const resolution = await resolveNametag(nametag);

      if (resolution) {
        setResolvedAddress(resolution.proxyAddress);
        setError(null);
      } else {
        setResolvedAddress(null);
        setError(`Nametag @${nametag} not found`);
      }

      setIsResolving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [recipient, resolveNametag]);

  const handleSetMax = () => {
    setAmount(maxAmountFormatted);
  };

  // Convert human-readable amount to smallest units
  const toSmallestUnits = (humanAmount: string): string => {
    const num = parseFloat(humanAmount);
    if (isNaN(num)) return '0';

    // Handle decimal places - combine integer and fractional parts
    const [intPart, fracPart = ''] = humanAmount.split('.');
    const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
    const combined = intPart + paddedFrac;

    // Remove leading zeros but keep at least one digit
    return combined.replace(/^0+/, '') || '0';
  };

  const isValidAmount = (): boolean => {
    const num = parseFloat(amount);
    const max = parseFloat(maxAmountFormatted);
    return !isNaN(num) && num > 0 && num <= max;
  };

  const canSubmit = (): boolean => {
    if (!recipient.trim()) return false;
    if (!isValidAmount()) return false;
    if (isResolving) return false;
    if (error) return false;
    if (sending || loading) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;

    try {
      setSending(true);
      setError(null);

      // Convert amount to smallest units
      const amountSmallest = toSmallestUnits(amount);

      await sendTokens(recipient.trim(), coinId, amountSmallest);

      // Success - go back to dashboard
      setView('dashboard');
    } catch (err) {
      setError((err as Error).message || 'Failed to send tokens');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setView('dashboard')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">Send</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Recipient
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter @nametag or address"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-white placeholder-gray-500 font-mono text-sm
                       focus:outline-none focus:border-purple-500"
          />

          {/* Resolution feedback */}
          {isResolving && (
            <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Resolving nametag...
            </div>
          )}
          {resolvedAddress && !isResolving && (
            <div className="mt-1 text-xs text-green-400">
              ✓ Resolved to {resolvedAddress.slice(0, 12)}...{resolvedAddress.slice(-8)}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-400">Amount</label>
            <span className="text-xs text-gray-500">
              Balance: {formatBalance(maxAmountRaw, coinId)} {symbol}
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-16
                         text-white placeholder-gray-500
                         focus:outline-none focus:border-purple-500"
            />
            <button
              type="button"
              onClick={handleSetMax}
              className="absolute right-2 top-1/2 -translate-y-1/2
                         text-xs text-purple-400 hover:text-purple-300
                         bg-gray-700 px-2 py-1 rounded"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Token Selector */}
        <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-500/20
                          flex items-center justify-center">
            <span className="text-xs font-medium text-purple-400">{symbol.slice(0, 2)}</span>
          </div>
          <div className="flex-1">
            <div className="font-medium">{symbol}</div>
            <div className="text-xs text-gray-500">Unicity Protocol</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit()}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                     text-white font-medium py-3 px-4 rounded-lg
                     transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </>
          ) : (
            'Send'
          )}
        </button>
      </form>

      <p className="mt-4 text-xs text-gray-500 text-center">
        Send to @nametag or direct address
      </p>
    </div>
  );
}

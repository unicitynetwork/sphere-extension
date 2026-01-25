/**
 * RegisterNametag - UI for registering a new nametag.
 */

import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';

type MintStatus = 'idle' | 'checking' | 'minting' | 'publishing' | 'success' | 'error';

export function RegisterNametag() {
  const [nametag, setNametag] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [mintStatus, setMintStatus] = useState<MintStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const { checkNametagAvailable, registerNametag } = useWallet();
  const { setView, loading } = useStore();

  // Validate nametag format
  const isValidFormat = useCallback((tag: string): boolean => {
    // Must be 3+ chars, alphanumeric only, lowercase
    return /^[a-z0-9]{3,}$/.test(tag);
  }, []);

  // Debounced availability check
  useEffect(() => {
    const cleanTag = nametag.toLowerCase().trim();

    if (cleanTag.length < 3) {
      setIsAvailable(null);
      return;
    }

    if (!isValidFormat(cleanTag)) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    setIsAvailable(null);

    const timer = setTimeout(async () => {
      try {
        const available = await checkNametagAvailable(cleanTag);
        setIsAvailable(available);
      } catch (err) {
        console.error('Check availability error:', err);
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [nametag, checkNametagAvailable, isValidFormat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
    setNametag(value);
    setError(null);
    setMintStatus('idle');
  };

  const handleRegister = async () => {
    if (!isAvailable || loading) return;

    const cleanTag = nametag.toLowerCase().trim();

    try {
      setError(null);
      setMintStatus('minting');

      await registerNametag(cleanTag);

      setMintStatus('success');

      // Navigate to receive screen after short delay
      setTimeout(() => {
        setView('receive');
      }, 1500);
    } catch (err) {
      setMintStatus('error');
      setError((err as Error).message || 'Failed to register nametag');
    }
  };

  const canRegister = isAvailable === true && mintStatus === 'idle' && !loading;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setView('receive')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">Register Nametag</h2>
      </div>

      {/* Info */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-300 mb-2">
          Register a unique nametag to receive tokens with a memorable name.
        </p>
        <p className="text-xs text-gray-400">
          Others can send tokens to <span className="text-purple-400">@yourname</span> instead of your address.
        </p>
      </div>

      {/* Input */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          Choose your nametag
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 text-lg">
            @
          </span>
          <input
            type="text"
            value={nametag}
            onChange={handleInputChange}
            placeholder="yourname"
            disabled={mintStatus !== 'idle'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-8 pr-12
                       text-white placeholder-gray-500 text-lg
                       focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={20}
          />

          {/* Availability indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isChecking && (
              <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            )}
            {!isChecking && isAvailable === true && (
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!isChecking && isAvailable === false && (
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Validation message */}
        <div className="mt-2 h-5">
          {nametag.length > 0 && nametag.length < 3 && (
            <p className="text-xs text-yellow-500">Must be at least 3 characters</p>
          )}
          {!isChecking && isAvailable === false && (
            <p className="text-xs text-red-400">This nametag is already taken</p>
          )}
          {!isChecking && isAvailable === true && (
            <p className="text-xs text-green-400">Available!</p>
          )}
        </div>
      </div>

      {/* Status messages */}
      {mintStatus !== 'idle' && mintStatus !== 'success' && mintStatus !== 'error' && (
        <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div>
              {mintStatus === 'checking' && (
                <p className="text-sm text-purple-300">Checking availability...</p>
              )}
              {mintStatus === 'minting' && (
                <p className="text-sm text-purple-300">Minting on-chain...</p>
              )}
              {mintStatus === 'publishing' && (
                <p className="text-sm text-purple-300">Publishing to NOSTR...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {mintStatus === 'success' && (
        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm text-green-300 font-medium">Nametag registered!</p>
              <p className="text-xs text-green-400">Redirecting...</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Register button */}
      <button
        onClick={handleRegister}
        disabled={!canRegister}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed
                   text-white font-medium py-3 px-4 rounded-lg
                   transition-colors"
      >
        {mintStatus === 'idle' && 'Register Nametag'}
        {mintStatus === 'minting' && 'Minting...'}
        {mintStatus === 'publishing' && 'Publishing...'}
        {mintStatus === 'success' && 'Registered!'}
        {mintStatus === 'error' && 'Try Again'}
      </button>

      {/* Cost info */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Nametag registration is free on testnet
      </p>
    </div>
  );
}

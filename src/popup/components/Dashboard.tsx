/**
 * Main dashboard view - shows balances and quick actions.
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';
import { ALPHA_COIN_ID, DEFAULT_COIN_SYMBOL } from '@/shared/constants';

export function Dashboard() {
  const { activeIdentity, balances, setView } = useStore();
  const { lockWallet, getAddress } = useWallet();
  const [address, setAddress] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getAddress().then(setAddress).catch(console.error);
  }, [getAddress]);

  // Get primary balance (first balance or one matching ALPHA_COIN_ID)
  const primaryBalance = balances.find((b) => b.coinId === ALPHA_COIN_ID) || balances[0];

  const formatBalance = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) return '0';
    if (num < 0.0001 && num > 0) return '< 0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const truncateAddress = (addr: string): string => {
    if (!addr) return '';
    return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
  };

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
          <div>
            <div className="text-sm text-gray-400">
              {activeIdentity?.label || 'Default'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setView('settings')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 mb-6">
        <div className="text-sm text-white/80 mb-1">Total Balance</div>
        <div className="text-3xl font-bold text-white mb-4">
          {formatBalance(primaryBalance?.amount || '0')} {primaryBalance?.symbol || DEFAULT_COIN_SYMBOL}
        </div>

        {/* Address */}
        <div
          onClick={copyAddress}
          className="bg-white/10 rounded-lg px-3 py-2 flex items-center justify-between
                     cursor-pointer hover:bg-white/20 transition-colors"
        >
          <span className="text-sm text-white/80 font-mono">
            {truncateAddress(address)}
          </span>
          <span className="text-xs text-white/60">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setView('receive')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center
                     transition-colors"
        >
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-500/20
                          flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <span className="text-sm text-white">Receive</span>
        </button>

        <button
          onClick={() => setView('send')}
          className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center
                     transition-colors"
        >
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/20
                          flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <span className="text-sm text-white">Send</span>
        </button>
      </div>

      {/* Token List */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-400 mb-3">Tokens</h3>
        <div className="space-y-2">
          {balances.map((balance) => (
            <div
              key={balance.coinId}
              className="bg-gray-800 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20
                                flex items-center justify-center">
                  <span className="text-xs font-medium text-purple-400">
                    {balance.symbol.slice(0, 2)}
                  </span>
                </div>
                <span className="font-medium">{balance.symbol}</span>
              </div>
              <span className="text-gray-400">
                {formatBalance(balance.amount)}
              </span>
            </div>
          ))}

          {balances.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              No tokens yet
            </div>
          )}
        </div>
      </div>

      {/* Lock Button */}
      <button
        onClick={lockWallet}
        className="w-full text-gray-400 hover:text-gray-300 text-sm py-2"
      >
        Lock Wallet
      </button>
    </div>
  );
}

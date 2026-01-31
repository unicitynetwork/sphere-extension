/**
 * Settings view - manage identities, export wallet, etc.
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';
import { GATEWAY_URL } from '@/shared/constants';

export function Settings() {
  const { activeIdentity, setView } = useStore();
  const {
    lockWallet,
    resetWallet,
    exportWallet,
    getMnemonic,
    getNostrPublicKey,
    getAggregatorConfig,
    setAggregatorConfig,
  } = useWallet();
  const [showExport, setShowExport] = useState(false);
  const [walletJson, setWalletJson] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [nostrKey, setNostrKey] = useState<{ hex: string; npub: string } | null>(null);

  // Aggregator config state
  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState(GATEWAY_URL);
  const [apiKey, setApiKey] = useState('');
  const [networkSaving, setNetworkSaving] = useState(false);
  const [networkSaved, setNetworkSaved] = useState(false);

  // Load aggregator config on mount
  useEffect(() => {
    getAggregatorConfig().then((config) => {
      setGatewayUrl(config.gatewayUrl);
      setApiKey(config.apiKey || '');
    });
  }, [getAggregatorConfig]);

  const handleExport = async () => {
    const json = await exportWallet();
    setWalletJson(json);
    setShowExport(true);
  };

  const handleShowMnemonic = async () => {
    const m = await getMnemonic();
    setMnemonic(m);
    setShowMnemonic(true);
  };

  const handleShowNostr = async () => {
    const keys = await getNostrPublicKey();
    setNostrKey(keys);
  };

  const downloadWallet = () => {
    const blob = new Blob([walletJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sphere-wallet.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveNetwork = async () => {
    setNetworkSaving(true);
    try {
      await setAggregatorConfig({
        gatewayUrl: gatewayUrl.trim() || GATEWAY_URL,
        apiKey: apiKey.trim() || undefined,
      });
      setNetworkSaved(true);
      setTimeout(() => setNetworkSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save network config:', error);
    } finally {
      setNetworkSaving(false);
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
        <h2 className="text-xl font-semibold">Settings</h2>
      </div>

      {/* Wallet Address */}
      {activeIdentity && (
        <div className="mb-6">
          <h3 className="text-sm text-gray-400 mb-3">Wallet</h3>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="font-medium">{activeIdentity.label}</div>
            <div className="text-xs text-gray-500 font-mono mt-1">
              {activeIdentity.publicKey.slice(0, 16)}...
            </div>
          </div>
        </div>
      )}

      {/* Mnemonic Backup */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-400 mb-3">Recovery Phrase</h3>
        {showMnemonic && mnemonic ? (
          <div className="space-y-3">
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
              <p className="text-xs text-yellow-400 mb-2">
                Write down these words and store them safely. Anyone with this phrase can access your wallet.
              </p>
              <div className="bg-gray-900 rounded p-3 font-mono text-sm text-gray-200 break-all">
                {mnemonic}
              </div>
            </div>
            <button
              onClick={() => { setShowMnemonic(false); setMnemonic(null); }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg
                         text-sm transition-colors"
            >
              Hide Recovery Phrase
            </button>
          </div>
        ) : (
          <button
            onClick={handleShowMnemonic}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm
                       text-gray-400 transition-colors"
          >
            Show Recovery Phrase
          </button>
        )}
      </div>

      {/* Network Configuration */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-400">Network</h3>
          <button
            onClick={() => setShowNetworkConfig(!showNetworkConfig)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            {showNetworkConfig ? 'Hide' : 'Configure'}
          </button>
        </div>

        {showNetworkConfig ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Gateway URL</label>
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder={GATEWAY_URL}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                           text-white placeholder-gray-500 text-sm font-mono
                           focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                           text-white placeholder-gray-500 text-sm
                           focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleSaveNetwork}
              disabled={networkSaving}
              className={`w-full py-2 px-4 rounded-lg text-sm transition-colors ${
                networkSaved
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {networkSaving ? 'Saving...' : networkSaved ? 'Saved!' : 'Save Network Settings'}
            </button>
            <p className="text-xs text-gray-500">
              Changes take effect immediately. Lock and unlock wallet to reconnect.
            </p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Current Gateway</div>
            <div className="text-xs font-mono text-gray-300 truncate">{gatewayUrl}</div>
            {apiKey && (
              <div className="text-xs text-green-400 mt-1">API Key configured</div>
            )}
          </div>
        )}
      </div>

      {/* NOSTR Key */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-400 mb-3">NOSTR Public Key</h3>
        {nostrKey ? (
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div>
              <div className="text-xs text-gray-500">npub</div>
              <div className="text-xs font-mono text-gray-300 break-all">{nostrKey.npub}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">hex</div>
              <div className="text-xs font-mono text-gray-300 break-all">{nostrKey.hex}</div>
            </div>
          </div>
        ) : (
          <button
            onClick={handleShowNostr}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm
                       text-gray-400 transition-colors"
          >
            Show NOSTR Public Key
          </button>
        )}
      </div>

      {/* Export Wallet */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-400 mb-3">Backup</h3>
        {showExport ? (
          <div className="space-y-3">
            <textarea
              value={walletJson}
              readOnly
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                         text-gray-300 text-xs font-mono resize-none"
            />
            <button
              onClick={downloadWallet}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg
                         text-sm transition-colors"
            >
              Download File
            </button>
          </div>
        ) : (
          <button
            onClick={handleExport}
            className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm
                       text-gray-400 transition-colors"
          >
            Export Wallet Backup
          </button>
        )}
      </div>

      {/* Lock Wallet */}
      <button
        onClick={lockWallet}
        className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400
                   py-3 px-4 rounded-lg transition-colors mb-3"
      >
        Lock Wallet
      </button>

      {/* Reset Wallet */}
      <button
        onClick={() => {
          if (confirm('This will permanently delete your wallet. Make sure you have backed up your recovery phrase. Continue?')) {
            resetWallet();
          }
        }}
        className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400/70
                   py-2 px-4 rounded-lg transition-colors text-sm"
      >
        Reset Wallet
      </button>
    </div>
  );
}

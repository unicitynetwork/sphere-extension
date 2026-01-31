/**
 * Create wallet view - initial setup flow.
 */

import { useState } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';

export function CreateWallet() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const { loading, setView } = useStore();
  const { createWallet } = useWallet();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const m = await createWallet(password);
      setMnemonic(m);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Show mnemonic backup screen after wallet creation
  if (mnemonic) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Backup Recovery Phrase</h2>

        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-400 mb-3">
            Write down these words in order and store them safely.
            Anyone with this phrase can access your wallet.
          </p>
          <div className="bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-200 break-all leading-relaxed">
            {mnemonic}
          </div>
        </div>

        <button
          onClick={() => setView('dashboard')}
          className="w-full bg-purple-600 hover:bg-purple-700
                     text-white font-medium py-2 px-4 rounded-lg
                     transition-colors"
        >
          I've Saved My Recovery Phrase
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-6">Create New Wallet</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password (min 8 characters)"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-white placeholder-gray-500
                       focus:outline-none focus:border-purple-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-white placeholder-gray-500
                       focus:outline-none focus:border-purple-500"
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                     text-white font-medium py-2 px-4 rounded-lg
                     transition-colors"
        >
          {loading ? 'Creating...' : 'Create Wallet'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-400 text-sm">
          Already have a wallet?{' '}
          <button
            onClick={() => setView('import-wallet')}
            className="text-purple-400 hover:text-purple-300"
          >
            Import from backup
          </button>
        </p>
      </div>
    </div>
  );
}

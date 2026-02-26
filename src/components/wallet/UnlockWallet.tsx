import { useState } from 'react';
import { Loader2, Lock, AlertCircle } from 'lucide-react';

interface UnlockWalletProps {
  onUnlock: (password: string) => Promise<void>;
}

export function UnlockWallet({ onUnlock }: UnlockWalletProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setError('');
    setIsLoading(true);

    try {
      await onUnlock(password);
    } catch (err) {
      setError((err as Error).message || 'Failed to unlock wallet');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-neutral-900 h-full relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl bg-orange-500/5 dark:bg-orange-500/10 pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl bg-purple-500/5 dark:bg-purple-500/10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Lock Icon */}
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl blur-lg opacity-50 bg-orange-500" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/25">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Unlock Wallet</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Enter your password to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Password"
              required
              autoFocus
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Unlocking...
              </span>
            ) : (
              'Unlock'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

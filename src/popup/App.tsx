/**
 * Main popup application component.
 */

import { useEffect } from 'react';
import { useStore } from './store';
import { useWallet } from './hooks/useWallet';
import { CreateWallet } from './components/CreateWallet';
import { ImportWallet } from './components/ImportWallet';
import { UnlockWallet } from './components/UnlockWallet';
import { Dashboard } from './components/Dashboard';
import { Send } from './components/Send';
import { Receive } from './components/Receive';
import { RegisterNametag } from './components/RegisterNametag';
import { Settings } from './components/Settings';
import { PendingTransactions } from './components/PendingTransactions';

export default function App() {
  const { view, loading, error } = useStore();
  const { initialize } = useWallet();

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Loading state
  if (view === 'loading') {
    return (
      <div className="min-h-[480px] bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500
                          animate-pulse mx-auto mb-4" />
          <p className="text-gray-400">{error || 'Loading...'}</p>
          {error && (
            <button
              onClick={initialize}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-[480px] bg-gray-900 text-white">
      {/* Header - only show on certain views */}
      {(view === 'create-wallet' || view === 'import-wallet') && (
        <header className="flex items-center gap-2 p-4 pb-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
          <h1 className="text-xl font-semibold">Sphere Wallet</h1>
        </header>
      )}

      {/* Main content based on view */}
      <main>
        {view === 'create-wallet' && <CreateWallet />}
        {view === 'import-wallet' && <ImportWallet />}
        {view === 'unlock' && <UnlockWallet />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'send' && <Send />}
        {view === 'receive' && <Receive />}
        {view === 'register-nametag' && <RegisterNametag />}
        {view === 'settings' && <Settings />}
        {view === 'pending-transactions' && <PendingTransactions />}
      </main>

      {/* Global loading overlay - shown when loading but not on initial load */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent
                          rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

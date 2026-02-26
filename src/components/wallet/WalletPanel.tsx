import { Wallet, Clock, Bell, MoreVertical, Tag, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { L3WalletView } from './L3WalletView';
import { useIdentity, useWalletStatus, useSphereContext } from '@/sdk';
import { AddressSelector, RegisterNametagModal } from '@/components/wallet/shared';
import { CreateWalletFlow } from './onboarding/CreateWalletFlow';

const PANEL_SHELL = "bg-white dark:bg-neutral-900 backdrop-blur-xl rounded-none border-0 overflow-hidden h-full relative flex flex-col transition-all duration-500";

export function WalletPanel() {
  const [showBalances, setShowBalances] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isL1WalletOpen, setIsL1WalletOpen] = useState(false);
  const [isNametagModalOpen, setIsNametagModalOpen] = useState(false);
  const { isLoading: isWalletLoading, walletExists, error: walletError } = useWalletStatus();
  const { identity, nametag, isLoading: isLoadingIdentity } = useIdentity();
  const { isLoading: _contextLoading } = useSphereContext();

  // Initialization error (e.g. IndexedDB timeout after retry)
  if (walletError) {
    return (
      <div className={PANEL_SHELL}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-red-500" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-neutral-900 dark:text-white">Initialization error</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Please reload the extension</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-orange-500/25 hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  // Wallet system still initializing
  if (isWalletLoading) {
    return (
      <div className={PANEL_SHELL}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-3 border-neutral-200 dark:border-neutral-800/50 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-1.5 border-3 border-orange-500/30 rounded-full border-t-orange-500 border-r-orange-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
            <div className="absolute inset-3 bg-orange-500/20 rounded-full blur-xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-orange-500 dark:text-orange-400 animate-spin" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Initializing wallet...
          </p>
        </div>
      </div>
    );
  }

  // No wallet — show onboarding flow inside the panel
  if (!walletExists) {
    return (
      <div className={PANEL_SHELL}>
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl bg-orange-500/5 dark:bg-orange-500/10" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl bg-purple-500/5 dark:bg-purple-500/10" />
        <div className="flex-1 relative overflow-y-auto">
          <CreateWalletFlow />
        </div>
      </div>
    );
  }

  // Wallet exists but identity still loading
  if (isLoadingIdentity || !identity) {
    return (
      <div className={PANEL_SHELL}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-3 border-neutral-200 dark:border-neutral-800/50 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
            <div className="absolute inset-1.5 border-3 border-orange-500/30 rounded-full border-t-orange-500 border-r-orange-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
            <div className="absolute inset-3 bg-orange-500/20 rounded-full blur-xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-orange-500 dark:text-orange-400 animate-spin" />
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Loading identity...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_SHELL}>

      {/* Background Gradients - Orange theme */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl bg-orange-500/5 dark:bg-orange-500/10" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl bg-purple-500/5 dark:bg-purple-500/10" />

      {/* TOP BAR: Title & Actions */}
      <div className="p-3 sm:p-4 pb-2 relative shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg sm:rounded-xl blur-lg opacity-50 bg-orange-500" />
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base text-neutral-900 dark:text-white font-medium tracking-wide">Wallet</span>
                {!nametag && (
                  <button
                    onClick={() => setIsNametagModalOpen(true)}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg transition-colors border border-orange-500/20"
                  >
                    <Tag className="w-3 h-3" />
                    <span>Register ID</span>
                  </button>
                )}
              </div>
              <AddressSelector compact />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 sm:p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-lg transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              title="Transaction history"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsRequestsOpen(true)}
              className="relative p-1.5 sm:p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-lg transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              title="Payment requests"
            >
              <Bell className="w-5 h-5" />
              {/* TODO: wire up pendingCount from useIncomingPaymentRequests */}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 sm:p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-lg transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              title="Settings"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT AREA - L3 Only */}
      <div className="flex-1 relative overflow-hidden">
        <L3WalletView
          showBalances={showBalances}
          setShowBalances={setShowBalances}
          isHistoryOpen={isHistoryOpen}
          setIsHistoryOpen={setIsHistoryOpen}
          isRequestsOpen={isRequestsOpen}
          setIsRequestsOpen={setIsRequestsOpen}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          isL1WalletOpen={isL1WalletOpen}
          setIsL1WalletOpen={setIsL1WalletOpen}
        />
      </div>

      <RegisterNametagModal
        isOpen={isNametagModalOpen}
        onClose={() => setIsNametagModalOpen(false)}
      />
    </div>
  );
}

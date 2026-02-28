import { Plus, ArrowUpRight, ArrowDownUp, Sparkles, Loader2, Coins, Layers, Eye, EyeOff, Wifi } from 'lucide-react';
import { AssetRow } from '@/components/wallet/shared/AssetRow';
import { TokenRow } from '@/components/wallet/shared/TokenRow';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useIdentity, useAssets, useTokens, useSphereContext } from '@/sdk';
import { SendModal } from './modals/SendModal';
import { SwapModal } from './modals/SwapModal';
import { PaymentRequestsModal } from './modals/PaymentRequestModal';
import type { IncomingPaymentRequest } from './modals/PaymentRequestModal';
import { TopUpModal } from './modals/TopUpModal';
import { SeedPhraseModal } from './modals/SeedPhraseModal';
import { TransactionHistoryModal } from './modals/TransactionHistoryModal';
import { SettingsModal } from './modals/SettingsModal';
import { BackupWalletModal, LogoutConfirmModal } from '@/components/wallet/shared';
import { SaveWalletModal } from '@/components/wallet/shared/SaveWalletModal';

type Tab = 'assets' | 'tokens';

// Static balance display (replaces Framer Motion animated numbers)
function BalanceDisplay({
  totalValue,
  showBalances,
  onToggle,
  isLoading,
}: {
  totalValue: number;
  showBalances: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}) {
  const formatted = `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex items-center gap-3">
      <h2 className="text-4xl text-neutral-900 dark:text-white font-bold tracking-tight">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-32 h-9 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
          </span>
        ) : showBalances ? (
          <span>{formatted}</span>
        ) : (
          '••••••'
        )}
      </h2>
      <button
        onClick={onToggle}
        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-lg transition-colors text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        title={showBalances ? "Hide balances" : "Show balances"}
      >
        {showBalances ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
      </button>
    </div>
  );
}

// Inline status line showing current wallet activity
function WalletStatusLine({
  isLoadingAssets,
  pendingCount,
}: {
  isLoadingAssets: boolean;
  pendingCount: number;
}) {
  const items: { label: string; spinning?: boolean }[] = [];

  if (isLoadingAssets) items.push({ label: 'Loading assets', spinning: true });
  if (pendingCount > 0) items.push({ label: `${pendingCount} pending transfer${pendingCount > 1 ? 's' : ''}` });

  if (items.length === 0) return null;

  // Show the first (most relevant) status item
  const current = items[0];

  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
      {current.spinning ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Wifi className="w-3 h-3" />
      )}
      <span>{current.label}...</span>
    </div>
  );
}

interface L3WalletViewProps {
  showBalances: boolean;
  setShowBalances: (value: boolean) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (value: boolean) => void;
  isRequestsOpen: boolean;
  setIsRequestsOpen: (value: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (value: boolean) => void;
  isL1WalletOpen: boolean;
  setIsL1WalletOpen: (value: boolean) => void;
}

export function L3WalletView({
  showBalances,
  setShowBalances,
  isHistoryOpen,
  setIsHistoryOpen,
  isRequestsOpen,
  setIsRequestsOpen,
  isSettingsOpen,
  setIsSettingsOpen,
  setIsL1WalletOpen,
}: L3WalletViewProps) {
  // SDK hooks
  const { identity, isLoading: isLoadingIdentity } = useIdentity();
  const { assets: sdkAssets, isLoading: isLoadingAssets } = useAssets();
  const { tokens: sdkTokens, pendingTokens } = useTokens();
  const { deleteWallet, getMnemonic, exportWallet } = useSphereContext();

  const assets = sdkAssets;
  const tokens = sdkTokens;
  const sendableTokens = useMemo(() => tokens.filter((t: any) => t.coinId !== 'NAMETAG'), [tokens]);

  const [activeTab, setActiveTab] = useState<Tab>('assets');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isSeedPhraseOpen, setIsSeedPhraseOpen] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

  // Track previous token/asset IDs to detect truly new items
  const prevTokenIdsRef = useRef<Set<string>>(new Set());
  const prevAssetCoinIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Compute new token IDs by comparing with previous snapshot
  const newTokenIds = useMemo(() => {
    if (isFirstLoadRef.current) {
      return new Set<string>(); // First load - no highlights
    }
    const newIds = new Set<string>();
    tokens.filter((t: any) => t.coinId !== 'NAMETAG').forEach((token: any) => {
      if (!prevTokenIdsRef.current.has(token.id)) {
        newIds.add(token.id);
      }
    });
    return newIds;
  }, [tokens]);

  // Compute new asset IDs by comparing with previous snapshot
  const newAssetCoinIds = useMemo(() => {
    if (isFirstLoadRef.current) {
      return new Set<string>(); // First load - no highlights
    }
    const newIds = new Set<string>();
    assets.forEach((asset: any) => {
      if (!prevAssetCoinIdsRef.current.has(asset.coinId)) {
        newIds.add(asset.coinId);
      }
    });
    return newIds;
  }, [assets]);

  // Update previous snapshots after render (for next comparison)
  useEffect(() => {
    const currentIds = new Set<string>(tokens.filter((t: any) => t.coinId !== 'NAMETAG').map((t: any) => t.id));
    prevTokenIdsRef.current = currentIds;
    isFirstLoadRef.current = false;
  }, [tokens]);

  useEffect(() => {
    const currentIds = new Set<string>(assets.map((a: any) => a.coinId));
    prevAssetCoinIdsRef.current = currentIds;
  }, [assets]);

  // New modal states
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isSaveWalletOpen, setIsSaveWalletOpen] = useState(false);

  // Payment requests (populated via wallet update events)
  const [paymentRequests, setPaymentRequests] = useState<IncomingPaymentRequest[]>([]);

  // Stable callback for toggling balance visibility
  const handleToggleBalances = useCallback(() => {
    setShowBalances(!showBalances);
  }, [showBalances, setShowBalances]);

  const totalValue = useMemo(() => {
    // Sum up L3 asset values (using SDK-provided fiat values for accuracy)
    const l3Value = sdkAssets.reduce((sum: number, asset: any) => sum + (asset.fiatValueUsd ?? 0), 0);
    return l3Value;
  }, [sdkAssets]);

  const handleShowSeedPhrase = async () => {
    try {
      const mnemonic = await getMnemonic();
      if (mnemonic) {
        setSeedPhrase(mnemonic.split(' '));
        setIsSeedPhraseOpen(true);
      } else {
        alert("Recovery phrase not available.\n\nThis wallet was imported from a file that doesn't contain a mnemonic phrase.");
      }
    } catch (err) {
      console.error('Failed to get mnemonic:', err);
    }
  };

  // Handle export wallet file
  const handleExportWalletFile = () => {
    setIsSaveWalletOpen(true);
  };

  // Handle save wallet
  const handleSaveWallet = async (filename: string) => {
    try {
      const jsonData = await exportWallet();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setIsSaveWalletOpen(false);
    } catch (err) {
      console.error('Failed to save wallet:', err);
    }
  };

  // Handle logout
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await deleteWallet();
      // In extension context, this will trigger state change via SphereProvider
    } catch (err) {
      console.error('Failed to logout:', err);
      setIsLoggingOut(false);
    }
  };

  // Handle backup and logout
  const handleBackupAndLogout = () => {
    setIsLogoutConfirmOpen(false);
    setIsBackupOpen(true);
  };

  if (isLoadingIdentity) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="animate-spin text-neutral-400 dark:text-neutral-600" />
        <WalletStatusLine
          isLoadingAssets={isLoadingAssets}
          pendingCount={0}
        />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No identity found. Please create a wallet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Main Balance - Centered with Eye Toggle */}
      <div className="px-6 mb-6 shrink-0">
        <div className="flex flex-col items-center justify-center mb-6 pt-2">
          <BalanceDisplay
            totalValue={totalValue}
            showBalances={showBalances}
            onToggle={handleToggleBalances}
            isLoading={isLoadingAssets && totalValue === 0}
          />
          <WalletStatusLine
            isLoadingAssets={isLoadingAssets}
            pendingCount={pendingTokens.length}
          />
        </div>

        {/* Actions - Speed focused */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => setIsTopUpModalOpen(true)}
            className="relative px-2 py-2.5 sm:px-3 sm:py-3 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 text-white text-xs sm:text-sm shadow-xl shadow-orange-500/20 flex items-center justify-center gap-1.5 sm:gap-2 overflow-hidden whitespace-nowrap hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-transform"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Top Up</span>
          </button>

          <button
            onClick={() => setIsSwapModalOpen(true)}
            className="relative px-2 py-2.5 sm:px-3 sm:py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 text-neutral-900 dark:text-white text-xs sm:text-sm border border-neutral-200 dark:border-neutral-700/50 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-transform"
          >
            <ArrowDownUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Swap</span>
          </button>

          <button
            onClick={() => setIsSendModalOpen(true)}
            disabled={sendableTokens.length === 0}
            className="relative px-2 py-2.5 sm:px-3 sm:py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 hover:bg-neutral-200 dark:hover:bg-neutral-700/80 text-neutral-900 dark:text-white text-xs sm:text-sm border border-neutral-200 dark:border-neutral-700/50 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-transform"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Send</span>
          </button>
        </div>

      </div>

      <div className="px-6 mb-4 shrink-0">
        <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all relative ${activeTab === 'assets' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-400'}`}
          >
            {activeTab === 'assets' && (
              <div className="absolute inset-0 bg-white dark:bg-neutral-800 rounded-lg shadow-sm transition-all duration-300" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Layers className="w-3 h-3" /> Assets
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all relative ${activeTab === 'tokens' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-400'}`}
          >
            {activeTab === 'tokens' && (
              <div className="absolute inset-0 bg-white dark:bg-neutral-800 rounded-lg shadow-sm transition-all duration-300" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Coins className="w-3 h-3" /> Tokens
            </span>
          </button>
        </div>
      </div>

      {/* Assets List */}
      <div className="p-6 pt-0 flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <h4 className="text-sm text-neutral-500 dark:text-neutral-400">Network Assets</h4>
          </div>
        </div>

        <div className="relative min-h-50">
          {isLoadingAssets ? (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {/* ASSETS VIEW */}
              {activeTab === 'assets' && (
                <div className="space-y-2">
                  {assets.length === 0 ? (
                    <EmptyState />
                  ) : (
                    <>
                      {/* L3 Assets */}
                      {assets.map((asset: any, index: number) => (
                        <AssetRow
                          key={asset.coinId}
                          asset={asset}
                          showBalances={showBalances}
                          delay={newAssetCoinIds.has(asset.coinId) ? (index + 1) * 0.05 : 0}
                          layer="L3"
                          isNew={newAssetCoinIds.has(asset.coinId)}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TOKENS VIEW */}
              {activeTab === 'tokens' && (
                <div className="space-y-2">
                  {tokens.filter((t: any) => t.coinId !== 'NAMETAG').length === 0 ? (
                    <EmptyState text="No individual tokens found." />
                  ) : (
                    tokens
                      .filter((t: any) => t.coinId !== 'NAMETAG')
                      .sort((a: any, b: any) => b.createdAt - a.createdAt)
                      .map((token: any, index: number) => (
                        <TokenRow
                          key={token.id}
                          token={token}
                          delay={newTokenIds.has(token.id) ? index * 0.05 : 0}
                          isNew={newTokenIds.has(token.id)}
                        />
                      ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <TopUpModal isOpen={isTopUpModalOpen} onClose={() => setIsTopUpModalOpen(false)} />
      <SendModal isOpen={isSendModalOpen} onClose={() => setIsSendModalOpen(false)} />
      <SwapModal isOpen={isSwapModalOpen} onClose={() => setIsSwapModalOpen(false)} />
      <PaymentRequestsModal
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
        requests={paymentRequests}
        pendingCount={paymentRequests.filter(r => r.status === 'pending').length}
        reject={async (req) => { setPaymentRequests(prev => prev.filter(r => r.id !== req.id)); }}
        paid={async (req) => { setPaymentRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'paid' as any } : r)); }}
        clearProcessed={() => { setPaymentRequests(prev => prev.filter(r => r.status === 'pending')); }}
      />
      <SeedPhraseModal
        isOpen={isSeedPhraseOpen}
        onClose={() => setIsSeedPhraseOpen(false)}
        seedPhrase={seedPhrase}
      />
      <TransactionHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onBackupWallet={() => setIsBackupOpen(true)}
        onLogout={() => setIsLogoutConfirmOpen(true)}
      />
      <BackupWalletModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onExportWalletFile={handleExportWalletFile}
        onShowRecoveryPhrase={handleShowSeedPhrase}
        hasMnemonic={true}
      />
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onBackupAndLogout={handleBackupAndLogout}
        onLogoutWithoutBackup={handleLogout}
        isLoggingOut={isLoggingOut}
      />
      <SaveWalletModal
        show={isSaveWalletOpen}
        onConfirm={handleSaveWallet}
        onCancel={() => setIsSaveWalletOpen(false)}
        hasMnemonic={true}
      />

    </div>
  );
}

// Helper Component
function EmptyState({ text }: { text?: string }) {
  return (
    <div className="text-center py-10 flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-neutral-400 dark:text-neutral-600" />
      </div>
      <div className="text-neutral-500 text-sm">
        {text || <>Wallet is empty.<br />Mint some tokens to start!</>}
      </div>
    </div>
  );
}

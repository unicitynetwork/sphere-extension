import React, { useState } from 'react';
import { useWalletStatus } from '@/sdk/hooks';
import { useSphereContext } from '@/sdk/context';
import { WalletPanel } from '@/components/wallet/WalletPanel';
import { UnlockWallet } from '@/components/wallet/UnlockWallet';

export function PopupApp() {
  const { walletExists, isLoading, isUnlocked } = useWalletStatus();
  const ctx = useSphereContext();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (walletExists && !isUnlocked) {
    return <UnlockWallet onUnlock={ctx.unlockWallet} />;
  }

  return <WalletPanel />;
}

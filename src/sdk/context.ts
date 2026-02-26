import { createContext, useContext } from 'react';
import type { WalletIdentity } from './types';

export interface SphereContextValue {
  // State
  walletExists: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;

  // Identity
  identity: WalletIdentity | null;
  nametag: string | null;

  // Wallet lifecycle
  createWallet: (password: string) => Promise<{ mnemonic: string }>;
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  unlockWallet: (password: string) => Promise<void>;
  lockWallet: () => Promise<void>;
  deleteWallet: () => Promise<void>;

  // Data fetching (returns raw data, caching handled by React Query in hooks)
  getAssets: () => Promise<any[]>;
  getTokens: () => Promise<any[]>;
  getTransactionHistory: () => Promise<any[]>;
  getIdentity: () => Promise<WalletIdentity | null>;

  // Operations
  send: (params: { coinId: string; amount: string; recipient: string; memo?: string }) => Promise<any>;
  resolve: (recipient: string) => Promise<any>;

  // Nametag
  registerNametag: (nametag: string) => Promise<any>;
  isNametagAvailable: (nametag: string) => Promise<boolean>;
  getMyNametag: () => Promise<any>;

  // Mnemonic
  getMnemonic: () => Promise<string | null>;
  exportWallet: () => Promise<string>;

  // Pending transactions (dApp)
  getPendingTransactions: () => Promise<any[]>;
  approveTransaction: (requestId: string) => Promise<void>;
  rejectTransaction: (requestId: string) => Promise<void>;

  // Config
  getAggregatorConfig: () => Promise<any>;
  setAggregatorConfig: (config: any) => Promise<void>;

  // Events
  onWalletUpdate: (callback: () => void) => () => void;
}

export const SphereContext = createContext<SphereContextValue | null>(null);

export function useSphereContext(): SphereContextValue {
  const ctx = useContext(SphereContext);
  if (!ctx) throw new Error('useSphereContext must be used within SphereProvider');
  return ctx;
}

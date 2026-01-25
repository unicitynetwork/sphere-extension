/**
 * Zustand store for popup state management.
 */

import { create } from 'zustand';
import type {
  WalletState,
  IdentityInfo,
  TokenBalance,
  PendingTransaction,
  NametagInfo,
} from '@/shared/types';

export type View =
  | 'loading'
  | 'create-wallet'
  | 'import-wallet'
  | 'unlock'
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'identities'
  | 'settings'
  | 'pending-transactions'
  | 'register-nametag';

interface PopupState {
  // Wallet state
  walletState: WalletState | null;
  activeIdentity: IdentityInfo | null;
  identities: IdentityInfo[];
  balances: TokenBalance[];
  pendingTransactions: PendingTransaction[];

  // Nametag state
  myNametag: NametagInfo | null;

  // UI state
  view: View;
  loading: boolean;
  error: string | null;

  // Actions
  setWalletState: (state: WalletState) => void;
  setActiveIdentity: (identity: IdentityInfo | null) => void;
  setIdentities: (identities: IdentityInfo[]) => void;
  setBalances: (balances: TokenBalance[]) => void;
  setPendingTransactions: (transactions: PendingTransaction[]) => void;
  setMyNametag: (nametag: NametagInfo | null) => void;
  setView: (view: View) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  walletState: null,
  activeIdentity: null,
  identities: [],
  balances: [],
  pendingTransactions: [],
  myNametag: null,
  view: 'loading' as View,
  loading: true,
  error: null,
};

export const useStore = create<PopupState>((set) => ({
  ...initialState,

  setWalletState: (walletState) => set({ walletState }),
  setActiveIdentity: (activeIdentity) => set({ activeIdentity }),
  setIdentities: (identities) => set({ identities }),
  setBalances: (balances) => set({ balances }),
  setPendingTransactions: (pendingTransactions) => set({ pendingTransactions }),
  setMyNametag: (myNametag) => set({ myNametag }),
  setView: (view) => set({ view }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

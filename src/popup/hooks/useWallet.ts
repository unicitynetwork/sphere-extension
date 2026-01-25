/**
 * Hook for wallet operations - communicates with background service worker.
 */

import { useCallback } from 'react';
import { useStore } from '../store';
import type {
  WalletState,
  IdentityInfo,
  TokenBalance,
  PendingTransaction,
  NametagInfo,
} from '@/shared/types';

/**
 * Send a message to the background service worker.
 */
async function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response.success) {
    throw new Error(response.error || 'Unknown error');
  }
  return response as T;
}

/**
 * Hook for wallet operations.
 */
export function useWallet() {
  const {
    setWalletState,
    setActiveIdentity,
    setIdentities,
    setBalances,
    setPendingTransactions,
    setMyNametag,
    setView,
    setLoading,
    setError,
  } = useStore();

  /**
   * Initialize popup - get current wallet state and navigate to appropriate view.
   */
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get wallet state
      const { state } = await sendMessage<{ state: WalletState }>({
        type: 'POPUP_GET_STATE',
      });

      setWalletState(state);

      // Check for pending transactions first
      const { transactions } = await sendMessage<{ transactions: PendingTransaction[] }>({
        type: 'POPUP_GET_PENDING_TRANSACTIONS',
      });

      setPendingTransactions(transactions);

      // Navigate to appropriate view
      if (!state.hasWallet) {
        setView('create-wallet');
      } else if (!state.isUnlocked) {
        setView('unlock');
      } else if (transactions.length > 0) {
        // If there are pending transactions, show them
        setView('pending-transactions');
      } else {
        // Load identity and balances, then show dashboard
        await loadWalletData();
        setView('dashboard');
      }
    } catch (error) {
      console.error('Initialize error:', error);
      setError((error as Error).message);
      setView('create-wallet');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setWalletState, setPendingTransactions, setView]);

  /**
   * Load wallet data (identities and balances).
   */
  const loadWalletData = useCallback(async () => {
    try {
      // Get identities
      const { identities, activeIdentityId } = await sendMessage<{
        identities: IdentityInfo[];
        activeIdentityId: string;
      }>({
        type: 'POPUP_GET_IDENTITIES',
      });

      setIdentities(identities);

      const activeIdentity = identities.find((i) => i.id === activeIdentityId) || null;
      setActiveIdentity(activeIdentity);

      // Get balances
      const { balances } = await sendMessage<{ balances: TokenBalance[] }>({
        type: 'POPUP_GET_BALANCES',
      });

      setBalances(balances);
    } catch (error) {
      console.error('Load wallet data error:', error);
      throw error;
    }
  }, [setIdentities, setActiveIdentity, setBalances]);

  /**
   * Create a new wallet.
   */
  const createWallet = useCallback(
    async (password: string, walletName?: string, identityLabel?: string) => {
      try {
        setLoading(true);
        setError(null);

        const { identity, state } = await sendMessage<{
          identity: IdentityInfo;
          state: WalletState;
        }>({
          type: 'POPUP_CREATE_WALLET',
          password,
          walletName,
          identityLabel,
        });

        setWalletState(state);
        setActiveIdentity(identity);
        setIdentities([identity]);

        await loadWalletData();
        setView('dashboard');
      } catch (error) {
        console.error('Create wallet error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setWalletState, setActiveIdentity, setIdentities, loadWalletData, setView]
  );

  /**
   * Import a wallet from JSON.
   */
  const importWallet = useCallback(
    async (walletJson: string, password: string) => {
      try {
        setLoading(true);
        setError(null);

        const { identity, state } = await sendMessage<{
          identity: IdentityInfo;
          state: WalletState;
        }>({
          type: 'POPUP_IMPORT_WALLET',
          walletJson,
          password,
        });

        setWalletState(state);
        setActiveIdentity(identity);

        await loadWalletData();
        setView('dashboard');
      } catch (error) {
        console.error('Import wallet error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setWalletState, setActiveIdentity, loadWalletData, setView]
  );

  /**
   * Unlock the wallet.
   */
  const unlockWallet = useCallback(
    async (password: string) => {
      try {
        setLoading(true);
        setError(null);

        const { identity, state } = await sendMessage<{
          identity: IdentityInfo;
          state: WalletState;
        }>({
          type: 'POPUP_UNLOCK_WALLET',
          password,
        });

        setWalletState(state);
        setActiveIdentity(identity);

        await loadWalletData();
        setView('dashboard');
      } catch (error) {
        console.error('Unlock wallet error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setWalletState, setActiveIdentity, loadWalletData, setView]
  );

  /**
   * Lock the wallet.
   */
  const lockWallet = useCallback(async () => {
    try {
      setLoading(true);

      const { state } = await sendMessage<{ state: WalletState }>({
        type: 'POPUP_LOCK_WALLET',
      });

      setWalletState(state);
      setActiveIdentity(null);
      setIdentities([]);
      setBalances([]);
      setView('unlock');
    } catch (error) {
      console.error('Lock wallet error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setWalletState, setActiveIdentity, setIdentities, setBalances, setView, setError]);

  /**
   * Create a new identity.
   */
  const createIdentity = useCallback(
    async (label: string) => {
      try {
        setLoading(true);

        const { identity } = await sendMessage<{ identity: IdentityInfo }>({
          type: 'POPUP_CREATE_IDENTITY',
          label,
        });

        await loadWalletData();
        return identity;
      } catch (error) {
        console.error('Create identity error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, loadWalletData]
  );

  /**
   * Switch active identity.
   */
  const switchIdentity = useCallback(
    async (identityId: string) => {
      try {
        setLoading(true);

        const { identity } = await sendMessage<{ identity: IdentityInfo }>({
          type: 'POPUP_SWITCH_IDENTITY',
          identityId,
        });

        setActiveIdentity(identity);
        await loadWalletData();
      } catch (error) {
        console.error('Switch identity error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setActiveIdentity, loadWalletData]
  );

  /**
   * Export wallet as JSON.
   */
  const exportWallet = useCallback(async (): Promise<string> => {
    const { walletJson } = await sendMessage<{ walletJson: string }>({
      type: 'POPUP_EXPORT_WALLET',
    });
    return walletJson;
  }, []);

  /**
   * Get receive address.
   */
  const getAddress = useCallback(async (): Promise<string> => {
    const { address } = await sendMessage<{ address: string }>({
      type: 'POPUP_GET_ADDRESS',
    });
    return address;
  }, []);

  /**
   * Approve a pending transaction.
   */
  const approveTransaction = useCallback(
    async (requestId: string) => {
      try {
        setLoading(true);

        await sendMessage({
          type: 'POPUP_APPROVE_TRANSACTION',
          requestId,
        });

        // Refresh pending transactions
        const { transactions } = await sendMessage<{ transactions: PendingTransaction[] }>({
          type: 'POPUP_GET_PENDING_TRANSACTIONS',
        });

        setPendingTransactions(transactions);

        // Refresh balances
        await loadWalletData();

        if (transactions.length === 0) {
          setView('dashboard');
        }
      } catch (error) {
        console.error('Approve transaction error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setPendingTransactions, loadWalletData, setView]
  );

  /**
   * Reject a pending transaction.
   */
  const rejectTransaction = useCallback(
    async (requestId: string) => {
      try {
        setLoading(true);

        await sendMessage({
          type: 'POPUP_REJECT_TRANSACTION',
          requestId,
        });

        // Refresh pending transactions
        const { transactions } = await sendMessage<{ transactions: PendingTransaction[] }>({
          type: 'POPUP_GET_PENDING_TRANSACTIONS',
        });

        setPendingTransactions(transactions);

        if (transactions.length === 0) {
          setView('dashboard');
        }
      } catch (error) {
        console.error('Reject transaction error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setPendingTransactions, setView]
  );

  /**
   * Get NOSTR public key.
   */
  const getNostrPublicKey = useCallback(async (): Promise<{ hex: string; npub: string }> => {
    const response = await sendMessage<{ hex: string; npub: string }>({
      type: 'POPUP_GET_NOSTR_PUBLIC_KEY',
    });
    return response;
  }, []);

  // ============ Nametag Operations ============

  /**
   * Check if a nametag is available for registration.
   */
  const checkNametagAvailable = useCallback(async (nametag: string): Promise<boolean> => {
    const { available } = await sendMessage<{ available: boolean }>({
      type: 'POPUP_CHECK_NAMETAG_AVAILABLE',
      nametag,
    });
    return available;
  }, []);

  /**
   * Register a nametag.
   */
  const registerNametag = useCallback(
    async (nametag: string): Promise<NametagInfo> => {
      try {
        setLoading(true);
        setError(null);

        const response = await sendMessage<{ nametag: NametagInfo }>({
          type: 'POPUP_REGISTER_NAMETAG',
          nametag,
        });

        setMyNametag(response.nametag);
        return response.nametag;
      } catch (error) {
        console.error('Register nametag error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setMyNametag]
  );

  /**
   * Get user's registered nametag.
   */
  const getMyNametag = useCallback(async (): Promise<NametagInfo | null> => {
    try {
      const { nametag } = await sendMessage<{ nametag: NametagInfo | null }>({
        type: 'POPUP_GET_MY_NAMETAG',
      });
      setMyNametag(nametag);
      return nametag;
    } catch (error) {
      console.error('Get nametag error:', error);
      return null;
    }
  }, [setMyNametag]);

  return {
    initialize,
    loadWalletData,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    createIdentity,
    switchIdentity,
    exportWallet,
    getAddress,
    approveTransaction,
    rejectTransaction,
    getNostrPublicKey,
    // Nametag operations
    checkNametagAvailable,
    registerNametag,
    getMyNametag,
  };
}

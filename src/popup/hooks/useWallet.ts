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
  AggregatorConfig,
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

      const { state } = await sendMessage<{ state: WalletState }>({
        type: 'POPUP_GET_STATE',
      });

      setWalletState(state);

      const { transactions } = await sendMessage<{ transactions: PendingTransaction[] }>({
        type: 'POPUP_GET_PENDING_TRANSACTIONS',
      });

      setPendingTransactions(transactions);

      if (!state.hasWallet) {
        setView('create-wallet');
      } else if (!state.isUnlocked) {
        setView('unlock');
      } else if (transactions.length > 0) {
        setView('pending-transactions');
      } else {
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
   * Load wallet data (identity and balances).
   */
  const loadWalletData = useCallback(async () => {
    try {
      const { identities, activeIdentityId } = await sendMessage<{
        identities: IdentityInfo[];
        activeIdentityId: string;
      }>({
        type: 'POPUP_GET_IDENTITIES',
      });

      setIdentities(identities);

      const activeIdentity = identities.find((i) => i.id === activeIdentityId) || null;
      setActiveIdentity(activeIdentity);

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
   * Create a new wallet. Returns the mnemonic for user backup.
   */
  const createWallet = useCallback(
    async (password: string): Promise<string> => {
      try {
        setLoading(true);
        setError(null);

        const { identity, mnemonic, state } = await sendMessage<{
          identity: IdentityInfo;
          mnemonic: string;
          state: WalletState;
        }>({
          type: 'POPUP_CREATE_WALLET',
          password,
        });

        setWalletState(state);
        setActiveIdentity(identity);
        setIdentities([identity]);

        await loadWalletData();
        return mnemonic;
      } catch (error) {
        console.error('Create wallet error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setWalletState, setActiveIdentity, setIdentities, loadWalletData]
  );

  /**
   * Import a wallet from mnemonic.
   */
  const importWallet = useCallback(
    async (mnemonic: string, password: string) => {
      try {
        setLoading(true);
        setError(null);

        const { identity, state } = await sendMessage<{
          identity: IdentityInfo;
          state: WalletState;
        }>({
          type: 'POPUP_IMPORT_WALLET',
          mnemonic,
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
   * Reset wallet - clear all data and return to create wallet screen.
   */
  const resetWallet = useCallback(async () => {
    try {
      setLoading(true);

      const { state } = await sendMessage<{ state: WalletState }>({
        type: 'POPUP_RESET_WALLET',
      });

      setWalletState(state);
      setActiveIdentity(null);
      setIdentities([]);
      setBalances([]);
      setMyNametag(null);
      setView('create-wallet');
    } catch (error) {
      console.error('Reset wallet error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setLoading, setWalletState, setActiveIdentity, setIdentities, setBalances, setMyNametag, setView, setError]);

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
   * Get mnemonic for backup display.
   */
  const getMnemonic = useCallback(async (): Promise<string | null> => {
    const { mnemonic } = await sendMessage<{ mnemonic: string | null }>({
      type: 'POPUP_GET_MNEMONIC',
    });
    return mnemonic;
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

        const { transactions } = await sendMessage<{ transactions: PendingTransaction[] }>({
          type: 'POPUP_GET_PENDING_TRANSACTIONS',
        });

        setPendingTransactions(transactions);
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

  const checkNametagAvailable = useCallback(async (nametag: string): Promise<boolean> => {
    const { available } = await sendMessage<{ available: boolean }>({
      type: 'POPUP_CHECK_NAMETAG_AVAILABLE',
      nametag,
    });
    return available;
  }, []);

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

  // ============ Aggregator Config ============

  const getAggregatorConfig = useCallback(async (): Promise<AggregatorConfig> => {
    try {
      const { config } = await sendMessage<{ config: AggregatorConfig }>({
        type: 'POPUP_GET_AGGREGATOR_CONFIG',
      });
      return config;
    } catch (error) {
      console.error('Get aggregator config error:', error);
      return { gatewayUrl: 'https://goggregator-test.unicity.network' };
    }
  }, []);

  const setAggregatorConfig = useCallback(
    async (config: AggregatorConfig): Promise<void> => {
      try {
        setLoading(true);
        await sendMessage({
          type: 'POPUP_SET_AGGREGATOR_CONFIG',
          config,
        });
      } catch (error) {
        console.error('Set aggregator config error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const sendTokens = useCallback(
    async (recipient: string, coinId: string, amount: string): Promise<string> => {
      try {
        setLoading(true);
        setError(null);
        const response = await sendMessage<{ transactionId: string }>({
          type: 'POPUP_SEND_TOKENS',
          recipient,
          coinId,
          amount,
        });
        await loadWalletData();
        return response.transactionId;
      } catch (error) {
        console.error('Send tokens error:', error);
        setError((error as Error).message);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, loadWalletData]
  );

  const resolveNametag = useCallback(
    async (nametag: string): Promise<{ nametag: string; pubkey: string; proxyAddress: string } | null> => {
      try {
        const response = await sendMessage<{ resolution: { nametag: string; pubkey: string; proxyAddress: string } | null }>({
          type: 'POPUP_RESOLVE_NAMETAG',
          nametag,
        });
        return response.resolution;
      } catch (error) {
        console.error('Resolve nametag error:', error);
        return null;
      }
    },
    []
  );

  return {
    initialize,
    loadWalletData,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    resetWallet,
    exportWallet,
    getMnemonic,
    getAddress,
    approveTransaction,
    rejectTransaction,
    getNostrPublicKey,
    // Nametag operations
    checkNametagAvailable,
    registerNametag,
    getMyNametag,
    resolveNametag,
    // Send operations
    sendTokens,
    // Aggregator config
    getAggregatorConfig,
    setAggregatorConfig,
  };
}

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SphereContext, type SphereContextValue } from '@/sdk/context';
import { SPHERE_KEYS } from '@/sdk/queryKeys';
import type { WalletIdentity } from '@/sdk/types';

async function sendMessage(message: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.success === false) {
        reject(new Error(response.error || 'Unknown error'));
        return;
      }
      resolve(response);
    });
  });
}

export function ExtensionSphereProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [walletExists, setWalletExists] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [nametag, setNametag] = useState<string | null>(null);
  const updateCallbacksRef = useRef<Set<() => void>>(new Set());

  // Fetch initial state
  useEffect(() => {
    (async () => {
      try {
        const res = await sendMessage({ type: 'POPUP_GET_STATE' });
        setWalletExists(res.state.hasWallet);
        setIsUnlocked(res.state.isUnlocked);

        if (res.state.isUnlocked) {
          try {
            const idRes = await sendMessage({ type: 'POPUP_GET_IDENTITIES' });
            if (idRes.identities?.[0]) {
              const id = idRes.identities[0];
              setIdentity({
                chainPubkey: id.publicKey,
                l1Address: id.id,
                directAddress: id.id,
                nametag: id.label?.startsWith('@') ? id.label.slice(1) : undefined,
              });
            }
            const ntRes = await sendMessage({ type: 'POPUP_GET_MY_NAMETAG' });
            if (ntRes.nametag) {
              setNametag(ntRes.nametag.nametag);
            }
          } catch {}
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Listen for background broadcasts
  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === 'BALANCES_UPDATED' || message.type === 'WALLET_UPDATE') {
        queryClient.invalidateQueries({ queryKey: SPHERE_KEYS.payments.all });
        queryClient.invalidateQueries({ queryKey: SPHERE_KEYS.identity.all });
        updateCallbacksRef.current.forEach(cb => cb());
      }
      if (message.type === 'PAYMENT_REQUEST_INCOMING') {
        updateCallbacksRef.current.forEach(cb => cb());
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [queryClient]);

  const createWallet = useCallback(async (password: string) => {
    const res = await sendMessage({ type: 'POPUP_CREATE_WALLET', password });
    setWalletExists(true);
    setIsUnlocked(true);
    if (res.identity) {
      setIdentity({
        chainPubkey: res.identity.publicKey,
        l1Address: res.identity.id,
        directAddress: res.identity.id,
      });
    }
    return { mnemonic: res.mnemonic };
  }, []);

  const importWallet = useCallback(async (mnemonic: string, password: string) => {
    const res = await sendMessage({ type: 'POPUP_IMPORT_WALLET', mnemonic, password });
    setWalletExists(true);
    setIsUnlocked(true);
    if (res.identity) {
      setIdentity({
        chainPubkey: res.identity.publicKey,
        l1Address: res.identity.id,
        directAddress: res.identity.id,
      });
    }
  }, []);

  const unlockWallet = useCallback(async (password: string) => {
    const res = await sendMessage({ type: 'POPUP_UNLOCK_WALLET', password });
    setIsUnlocked(true);
    if (res.identity) {
      setIdentity({
        chainPubkey: res.identity.publicKey,
        l1Address: res.identity.id,
        directAddress: res.identity.id,
        nametag: res.identity.label?.startsWith('@') ? res.identity.label.slice(1) : undefined,
      });
    }
    // Fetch nametag
    try {
      const ntRes = await sendMessage({ type: 'POPUP_GET_MY_NAMETAG' });
      if (ntRes.nametag) setNametag(ntRes.nametag.nametag);
    } catch {}
  }, []);

  const lockWallet = useCallback(async () => {
    await sendMessage({ type: 'POPUP_LOCK_WALLET' });
    setIsUnlocked(false);
    setIdentity(null);
    setNametag(null);
    queryClient.clear();
  }, [queryClient]);

  const deleteWallet = useCallback(async () => {
    await sendMessage({ type: 'POPUP_RESET_WALLET' });
    setWalletExists(false);
    setIsUnlocked(false);
    setIdentity(null);
    setNametag(null);
    queryClient.clear();
  }, [queryClient]);

  const getAssets = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_ASSETS' });
    return res.assets ?? [];
  }, []);

  const getTokens = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_TOKENS' });
    return res.tokens ?? [];
  }, []);

  const getTransactionHistory = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_TRANSACTION_HISTORY' });
    return res.history ?? [];
  }, []);

  const getIdentity = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_IDENTITY' });
    return res.identity ?? null;
  }, []);

  const send = useCallback(async (params: { coinId: string; amount: string; recipient: string; memo?: string }) => {
    return sendMessage({ type: 'POPUP_SEND_TOKENS', ...params });
  }, []);

  const resolve = useCallback(async (recipient: string) => {
    const res = await sendMessage({ type: 'POPUP_RESOLVE_NAMETAG', nametag: recipient });
    return res.resolution ?? null;
  }, []);

  const registerNametag = useCallback(async (tag: string) => {
    const res = await sendMessage({ type: 'POPUP_REGISTER_NAMETAG', nametag: tag });
    if (res.nametag) setNametag(res.nametag.nametag);
    return res.nametag;
  }, []);

  const isNametagAvailable = useCallback(async (tag: string) => {
    const res = await sendMessage({ type: 'POPUP_CHECK_NAMETAG_AVAILABLE', nametag: tag });
    return res.available ?? false;
  }, []);

  const getMyNametag = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_MY_NAMETAG' });
    return res.nametag ?? null;
  }, []);

  const getMnemonic = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_MNEMONIC' });
    return res.mnemonic ?? null;
  }, []);

  const exportWallet = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_EXPORT_WALLET' });
    return res.walletJson ?? '';
  }, []);

  const getPendingTransactions = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_PENDING_TRANSACTIONS' });
    return res.transactions ?? [];
  }, []);

  const approveTransaction = useCallback(async (requestId: string) => {
    await sendMessage({ type: 'POPUP_APPROVE_TRANSACTION', requestId });
  }, []);

  const rejectTransaction = useCallback(async (requestId: string) => {
    await sendMessage({ type: 'POPUP_REJECT_TRANSACTION', requestId });
  }, []);

  const getAggregatorConfig = useCallback(async () => {
    const res = await sendMessage({ type: 'POPUP_GET_AGGREGATOR_CONFIG' });
    return res.config;
  }, []);

  const setAggregatorConfig = useCallback(async (config: any) => {
    await sendMessage({ type: 'POPUP_SET_AGGREGATOR_CONFIG', config });
  }, []);

  const onWalletUpdate = useCallback((callback: () => void) => {
    updateCallbacksRef.current.add(callback);
    return () => { updateCallbacksRef.current.delete(callback); };
  }, []);

  const value: SphereContextValue = {
    walletExists,
    isUnlocked,
    isLoading,
    error,
    identity,
    nametag,
    createWallet,
    importWallet,
    unlockWallet,
    lockWallet,
    deleteWallet,
    getAssets,
    getTokens,
    getTransactionHistory,
    getIdentity,
    send,
    resolve,
    registerNametag,
    isNametagAvailable,
    getMyNametag,
    getMnemonic,
    exportWallet,
    getPendingTransactions,
    approveTransaction,
    rejectTransaction,
    getAggregatorConfig,
    setAggregatorConfig,
    onWalletUpdate,
  };

  return (
    <SphereContext.Provider value={value}>
      {children}
    </SphereContext.Provider>
  );
}

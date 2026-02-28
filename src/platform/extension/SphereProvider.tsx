import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TokenRegistry, NETWORKS } from '@unicitylabs/sphere-sdk';
import { SphereContext, type SphereContextValue } from '@/sdk/context';
import { SPHERE_KEYS } from '@/sdk/queryKeys';
import { getErrorMessage } from '@/sdk/errors';
import type { WalletIdentity } from '@/sdk/types';
import type { Asset, Token, TransactionHistoryEntry } from '@unicitylabs/sphere-sdk';
import type { AggregatorConfig, NametagInfo, NametagResolution, PendingTransaction } from '@/shared/types';

async function sendMessage<T = Record<string, unknown>>(message: Record<string, unknown>): Promise<T> {
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
      resolve(response as T);
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

  // Configure TokenRegistry singleton for popup bundle (same as sphere web app)
  useEffect(() => {
    const netConfig = NETWORKS['testnet'];
    TokenRegistry.configure({
      remoteUrl: netConfig.tokenRegistryUrl,
    });
  }, []);

  // Fetch initial state
  useEffect(() => {
    (async () => {
      try {
        const res = await sendMessage<{ state: { hasWallet: boolean; isUnlocked: boolean } }>({ type: 'POPUP_GET_STATE' });
        setWalletExists(res.state.hasWallet);
        setIsUnlocked(res.state.isUnlocked);

        if (res.state.isUnlocked) {
          try {
            const idRes = await sendMessage<{ identities?: Array<{ publicKey: string; id: string; label?: string }> }>({ type: 'POPUP_GET_IDENTITIES' });
            const ntRes = await sendMessage<{ nametag?: { nametag: string } }>({ type: 'POPUP_GET_MY_NAMETAG' });

            // Resolve nametag: prefer stored nametag, fall back to identity label
            const storedNametag = ntRes.nametag?.nametag ?? null;
            const labelNametag = idRes.identities?.[0]?.label?.startsWith('@')
              ? idRes.identities[0].label.slice(1)
              : undefined;
            const resolvedNametag = storedNametag ?? labelNametag ?? null;

            if (idRes.identities?.[0]) {
              const id = idRes.identities[0];
              setIdentity({
                chainPubkey: id.publicKey,
                l1Address: id.id,
                directAddress: id.id,
                nametag: resolvedNametag ?? undefined,
              });
            }
            if (resolvedNametag) {
              setNametag(resolvedNametag);
            }
          } catch { /* non-fatal — identity loaded without nametag */ }
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Listen for background broadcasts
  useEffect(() => {
    const listener = (message: { type?: string }) => {
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

  type IdentityPayload = { publicKey: string; id: string; label?: string };

  const createWallet = useCallback(async (password: string) => {
    const res = await sendMessage<{ identity?: IdentityPayload; mnemonic: string }>({ type: 'POPUP_CREATE_WALLET', password });
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
    const res = await sendMessage<{ identity?: IdentityPayload }>({ type: 'POPUP_IMPORT_WALLET', mnemonic, password });
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
    const res = await sendMessage<{ identity?: IdentityPayload }>({ type: 'POPUP_UNLOCK_WALLET', password });
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
      const ntRes = await sendMessage<{ nametag?: { nametag: string } }>({ type: 'POPUP_GET_MY_NAMETAG' });
      if (ntRes.nametag) setNametag(ntRes.nametag.nametag);
    } catch { /* non-fatal — nametag fetch failed, continue without it */ }
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
    const res = await sendMessage<{ assets?: Asset[] }>({ type: 'POPUP_GET_ASSETS' });
    return res.assets ?? [];
  }, []);

  const getTokens = useCallback(async () => {
    const res = await sendMessage<{ tokens?: Token[] }>({ type: 'POPUP_GET_TOKENS' });
    return res.tokens ?? [];
  }, []);

  const getTransactionHistory = useCallback(async () => {
    const res = await sendMessage<{ history?: TransactionHistoryEntry[] }>({ type: 'POPUP_GET_TRANSACTION_HISTORY' });
    return res.history ?? [];
  }, []);

  const getIdentity = useCallback(async () => {
    const res = await sendMessage<{ identity?: WalletIdentity | null }>({ type: 'POPUP_GET_IDENTITY' });
    return res.identity ?? null;
  }, []);

  const send = useCallback(async (params: { coinId: string; amount: string; recipient: string; memo?: string }) => {
    return sendMessage<{ transactionId?: string }>({ type: 'POPUP_SEND_TOKENS', ...params });
  }, []);

  const resolve = useCallback(async (recipient: string) => {
    const res = await sendMessage<{ resolution?: NametagResolution | null }>({ type: 'POPUP_RESOLVE_NAMETAG', nametag: recipient });
    return res.resolution ?? null;
  }, []);

  const registerNametag = useCallback(async (tag: string) => {
    const res = await sendMessage<{ nametag?: NametagInfo }>({ type: 'POPUP_REGISTER_NAMETAG', nametag: tag });
    const cleanTag = tag.replace('@', '').trim().toLowerCase();
    if (res.nametag) {
      setNametag(res.nametag.nametag);
    } else {
      // Even if response doesn't include nametag info, set it locally
      // (NOSTR binding may have succeeded even if mint failed)
      setNametag(cleanTag);
    }
    // Also update identity with the nametag so useIdentity picks it up
    setIdentity(prev => prev ? { ...prev, nametag: cleanTag } : prev);
    return res.nametag as NametagInfo;
  }, []);

  const isNametagAvailable = useCallback(async (tag: string) => {
    const res = await sendMessage<{ available?: boolean }>({ type: 'POPUP_CHECK_NAMETAG_AVAILABLE', nametag: tag });
    return res.available ?? false;
  }, []);

  const getMyNametag = useCallback(async () => {
    const res = await sendMessage<{ nametag?: NametagInfo | null }>({ type: 'POPUP_GET_MY_NAMETAG' });
    return res.nametag ?? null;
  }, []);

  const getMnemonic = useCallback(async () => {
    const res = await sendMessage<{ mnemonic?: string | null }>({ type: 'POPUP_GET_MNEMONIC' });
    return res.mnemonic ?? null;
  }, []);

  const exportWallet = useCallback(async () => {
    const res = await sendMessage<{ walletJson?: string }>({ type: 'POPUP_EXPORT_WALLET' });
    return res.walletJson ?? '';
  }, []);

  const getPendingTransactions = useCallback(async () => {
    const res = await sendMessage<{ transactions?: PendingTransaction[] }>({ type: 'POPUP_GET_PENDING_TRANSACTIONS' });
    return res.transactions ?? [];
  }, []);

  const approveTransaction = useCallback(async (requestId: string) => {
    await sendMessage({ type: 'POPUP_APPROVE_TRANSACTION', requestId });
  }, []);

  const rejectTransaction = useCallback(async (requestId: string) => {
    await sendMessage({ type: 'POPUP_REJECT_TRANSACTION', requestId });
  }, []);

  const getAggregatorConfig = useCallback(async () => {
    const res = await sendMessage<{ config: AggregatorConfig }>({ type: 'POPUP_GET_AGGREGATOR_CONFIG' });
    return res.config;
  }, []);

  const setAggregatorConfig = useCallback(async (config: AggregatorConfig) => {
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

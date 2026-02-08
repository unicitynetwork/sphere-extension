/**
 * Background message handler - routes messages between content scripts and popup.
 *
 * Handles:
 * - SPHERE_* messages from web pages via content script
 * - POPUP_* messages from the extension popup
 * - Pending transaction management
 * - Tab tracking for transaction origins
 */

import { walletManager } from './wallet-manager';
import { nametagMintService } from './nametag-mint-service';
import {
  addPendingTransaction,
  removePendingTransaction,
  getPendingTransactions,
  getPreferences,
  savePreferences,
} from './storage';
import type {
  PendingTransaction,
  SendTransactionData,
  SignMessageData,
  SignNostrData,
  IdentityInfo,
  TokenBalance,
  NametagInfo,
} from '@/shared/types';

/** Connected sites (origin -> boolean) */
const connectedSites = new Map<string, boolean>();

/** Pending connect requests waiting for wallet unlock */
interface PendingConnectRequest {
  origin: string;
  resolve: (response: { type: string; success: boolean; identity?: IdentityInfo; error?: string }) => void;
  timestamp: number;
}
const pendingConnectRequests: PendingConnectRequest[] = [];

/** Timeout for pending connect requests (60 seconds) */
const CONNECT_TIMEOUT_MS = 60000;

/**
 * Resolve all pending connect requests after wallet unlock.
 */
function resolvePendingConnectRequests(): void {
  if (!walletManager.isUnlocked()) return;

  const identity = walletManager.getActiveIdentity();

  while (pendingConnectRequests.length > 0) {
    const request = pendingConnectRequests.shift();
    if (request) {
      connectedSites.set(request.origin, true);
      request.resolve({
        type: 'SPHERE_CONNECT_RESPONSE',
        success: true,
        identity,
      });
    }
  }
}

/**
 * Handle messages from content scripts (web page requests).
 */
export async function handleContentMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  const type = message.type as string;
  const requestId = message.requestId as string;
  const origin = message.origin as string;

  console.log('Background received message:', type, requestId, 'from', origin);

  try {
    switch (type) {
      case 'SPHERE_CONNECT':
        return handleConnect(origin);

      case 'SPHERE_DISCONNECT':
        return handleDisconnect(origin);

      case 'SPHERE_GET_ACTIVE_IDENTITY':
        return handleGetActiveIdentity(origin);

      case 'SPHERE_GET_BALANCES':
        return handleGetBalances(origin);

      case 'SPHERE_SEND_TOKENS':
        return handleSendTokensRequest(
          requestId,
          origin,
          sender.tab?.id ?? 0,
          {
            recipient: message.recipient as string,
            coinId: message.coinId as string,
            amount: message.amount as string,
            message: message.message as string | undefined,
          }
        );

      case 'SPHERE_SIGN_MESSAGE':
        return handleSignMessageRequest(
          requestId,
          origin,
          sender.tab?.id ?? 0,
          message.message as string
        );

      case 'SPHERE_GET_NOSTR_PUBLIC_KEY':
        return handleGetNostrPublicKey(origin);

      case 'SPHERE_SIGN_NOSTR_EVENT':
        return handleSignNostrEventRequest(
          requestId,
          origin,
          sender.tab?.id ?? 0,
          message.eventHash as string
        );

      case 'SPHERE_NIP44_ENCRYPT':
        return handleNip44Encrypt(
          origin,
          message.recipientPubkey as string,
          message.plaintext as string
        );

      case 'SPHERE_NIP44_DECRYPT':
        return handleNip44Decrypt(
          origin,
          message.senderPubkey as string,
          message.ciphertext as string
        );

      case 'SPHERE_RESOLVE_NAMETAG':
        return handleResolveNametag(origin, message.nametag as string);

      case 'SPHERE_CHECK_NAMETAG_AVAILABLE':
        return handleCheckNametagAvailable(origin, message.nametag as string);

      case 'SPHERE_GET_MY_NAMETAG':
        return handleGetMyNametag(origin);

      default:
        return {
          type: `${type}_RESPONSE`,
          success: false,
          error: `Unknown message type: ${type}`,
        };
    }
  } catch (error) {
    console.error('Background handler error:', error);
    return {
      type: `${type}_RESPONSE`,
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

/**
 * Handle messages from the popup.
 */
export async function handlePopupMessage(
  message: Record<string, unknown>
): Promise<unknown> {
  const type = message.type as string;

  console.log('Background received popup message:', type);

  try {
    switch (type) {
      case 'POPUP_GET_STATE':
        return {
          success: true,
          state: await walletManager.getState(),
        };

      case 'POPUP_CREATE_WALLET': {
        const password = message.password as string;
        const { identity, mnemonic } = await walletManager.createWallet(password);
        return {
          success: true,
          identity,
          mnemonic,
          state: await walletManager.getState(),
        };
      }

      case 'POPUP_IMPORT_WALLET': {
        const mnemonic = message.mnemonic as string;
        const password = message.password as string;
        const identity = await walletManager.importWallet(mnemonic, password);
        return {
          success: true,
          identity,
          state: await walletManager.getState(),
        };
      }

      case 'POPUP_UNLOCK_WALLET': {
        const password = message.password as string;
        const identity = await walletManager.unlock(password);

        // Resolve any pending connect requests now that wallet is unlocked
        resolvePendingConnectRequests();

        return {
          success: true,
          identity,
          state: await walletManager.getState(),
        };
      }

      case 'POPUP_LOCK_WALLET':
        await walletManager.lock();
        return {
          success: true,
          state: await walletManager.getState(),
        };

      case 'POPUP_RESET_WALLET':
        await walletManager.resetWallet();
        return {
          success: true,
          state: await walletManager.getState(),
        };

      case 'POPUP_GET_IDENTITIES':
        return {
          success: true,
          identities: walletManager.listIdentities(),
          activeIdentityId: walletManager.getActiveIdentity().id,
        };

      case 'POPUP_GET_BALANCES':
        return {
          success: true,
          balances: walletManager.getBalances(),
        };

      case 'POPUP_EXPORT_WALLET':
        return {
          success: true,
          walletJson: walletManager.exportWallet(),
        };

      case 'POPUP_GET_MNEMONIC':
        return {
          success: true,
          mnemonic: walletManager.getMnemonic(),
        };

      case 'POPUP_GET_PENDING_TRANSACTIONS':
        return {
          success: true,
          transactions: await getPendingTransactions(),
        };

      case 'POPUP_APPROVE_TRANSACTION': {
        const requestId = message.requestId as string;
        return handleApproveTransaction(requestId);
      }

      case 'POPUP_REJECT_TRANSACTION': {
        const requestId = message.requestId as string;
        return handleRejectTransaction(requestId);
      }

      case 'POPUP_GET_NOSTR_PUBLIC_KEY':
        return {
          success: true,
          ...walletManager.getNostrPublicKey(),
        };

      case 'POPUP_GET_ADDRESS': {
        const address = await walletManager.getAddress();
        return {
          success: true,
          address,
        };
      }

      case 'POPUP_GET_PREFERENCES':
        return {
          success: true,
          preferences: await getPreferences(),
        };

      case 'POPUP_SAVE_PREFERENCES': {
        const preferences = message.preferences as Parameters<typeof savePreferences>[0];
        await savePreferences(preferences);
        return { success: true };
      }

      case 'POPUP_CHECK_NAMETAG_AVAILABLE': {
        const nametag = message.nametag as string;
        return handlePopupCheckNametagAvailable(nametag);
      }

      case 'POPUP_REGISTER_NAMETAG': {
        const nametag = message.nametag as string;
        return handlePopupRegisterNametag(nametag);
      }

      case 'POPUP_GET_MY_NAMETAG':
        return handlePopupGetMyNametag();

      case 'POPUP_GET_AGGREGATOR_CONFIG':
        return handlePopupGetAggregatorConfig();

      case 'POPUP_SET_AGGREGATOR_CONFIG': {
        const config = message.config as { gatewayUrl: string; apiKey?: string };
        return handlePopupSetAggregatorConfig(config);
      }

      case 'POPUP_SEND_TOKENS': {
        const { recipient, coinId, amount } = message as {
          recipient: string;
          coinId: string;
          amount: string;
        };
        return handlePopupSendTokens(recipient, coinId, amount);
      }

      case 'POPUP_RESOLVE_NAMETAG': {
        const nametag = message.nametag as string;
        return handlePopupResolveNametag(nametag);
      }

      default:
        return {
          success: false,
          error: `Unknown popup message type: ${type}`,
        };
    }
  } catch (error) {
    console.error('Background popup handler error:', error);
    return {
      success: false,
      error: (error as Error).message || 'Unknown error',
    };
  }
}

// ============ SPHERE_* Message Handlers ============

async function handleConnect(origin: string): Promise<{
  type: string;
  success: boolean;
  identity?: IdentityInfo;
  error?: string;
}> {
  // If wallet is already unlocked, connect immediately
  if (walletManager.isUnlocked()) {
    connectedSites.set(origin, true);
    const identity = walletManager.getActiveIdentity();
    return {
      type: 'SPHERE_CONNECT_RESPONSE',
      success: true,
      identity,
    };
  }

  // Wallet is locked - open popup and wait for unlock
  await openPopup();

  return new Promise((resolve) => {
    const request: PendingConnectRequest = {
      origin,
      resolve,
      timestamp: Date.now(),
    };
    pendingConnectRequests.push(request);

    // Set timeout to avoid hanging forever
    setTimeout(() => {
      const index = pendingConnectRequests.indexOf(request);
      if (index !== -1) {
        pendingConnectRequests.splice(index, 1);
        resolve({
          type: 'SPHERE_CONNECT_RESPONSE',
          success: false,
          error: 'Connection timed out. Please try again.',
        });
      }
    }, CONNECT_TIMEOUT_MS);
  });
}

async function handleDisconnect(origin: string): Promise<{ type: string; success: boolean }> {
  connectedSites.delete(origin);
  return {
    type: 'SPHERE_DISCONNECT_RESPONSE',
    success: true,
  };
}

async function handleGetActiveIdentity(origin: string): Promise<{
  type: string;
  success: boolean;
  identity?: IdentityInfo | null;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_GET_ACTIVE_IDENTITY_RESPONSE',
      success: true,
      identity: null,
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_GET_ACTIVE_IDENTITY_RESPONSE',
      success: true,
      identity: null,
    };
  }

  return {
    type: 'SPHERE_GET_ACTIVE_IDENTITY_RESPONSE',
    success: true,
    identity: walletManager.getActiveIdentity(),
  };
}

async function handleGetBalances(origin: string): Promise<{
  type: string;
  success: boolean;
  balances?: TokenBalance[];
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_GET_BALANCES_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_GET_BALANCES_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  return {
    type: 'SPHERE_GET_BALANCES_RESPONSE',
    success: true,
    balances: walletManager.getBalances(),
  };
}

async function handleSendTokensRequest(
  requestId: string,
  origin: string,
  tabId: number,
  params: { recipient: string; coinId: string; amount: string; message?: string }
): Promise<{ type: string; success: boolean; error?: string }> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_SEND_TOKENS_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_SEND_TOKENS_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  const tx: PendingTransaction = {
    requestId,
    type: 'send',
    origin,
    tabId,
    timestamp: Date.now(),
    data: {
      recipient: params.recipient,
      coinId: params.coinId,
      amount: params.amount,
      message: params.message,
    } as SendTransactionData,
  };

  await addPendingTransaction(tx);
  await openPopup();

  return {
    type: 'SPHERE_SEND_TOKENS_RESPONSE',
    success: true,
  };
}

async function handleSignMessageRequest(
  requestId: string,
  origin: string,
  tabId: number,
  message: string
): Promise<{ type: string; success: boolean; error?: string }> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_SIGN_MESSAGE_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_SIGN_MESSAGE_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  const tx: PendingTransaction = {
    requestId,
    type: 'sign_message',
    origin,
    tabId,
    timestamp: Date.now(),
    data: { message } as SignMessageData,
  };

  await addPendingTransaction(tx);
  await openPopup();

  return {
    type: 'SPHERE_SIGN_MESSAGE_RESPONSE',
    success: true,
  };
}

async function handleGetNostrPublicKey(origin: string): Promise<{
  type: string;
  success: boolean;
  publicKey?: string;
  npub?: string;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_GET_NOSTR_PUBLIC_KEY_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_GET_NOSTR_PUBLIC_KEY_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  const keys = walletManager.getNostrPublicKey();
  return {
    type: 'SPHERE_GET_NOSTR_PUBLIC_KEY_RESPONSE',
    success: true,
    publicKey: keys.hex,
    npub: keys.npub,
  };
}

async function handleNip44Encrypt(
  origin: string,
  recipientPubkey: string,
  plaintext: string
): Promise<{
  type: string;
  success: boolean;
  ciphertext?: string;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_NIP44_ENCRYPT_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_NIP44_ENCRYPT_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const ciphertext = walletManager.nip44Encrypt(recipientPubkey, plaintext);
    return {
      type: 'SPHERE_NIP44_ENCRYPT_RESPONSE',
      success: true,
      ciphertext,
    };
  } catch (error) {
    return {
      type: 'SPHERE_NIP44_ENCRYPT_RESPONSE',
      success: false,
      error: (error as Error).message,
    };
  }
}

async function handleNip44Decrypt(
  origin: string,
  senderPubkey: string,
  ciphertext: string
): Promise<{
  type: string;
  success: boolean;
  plaintext?: string;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_NIP44_DECRYPT_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_NIP44_DECRYPT_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const plaintext = walletManager.nip44Decrypt(senderPubkey, ciphertext);
    return {
      type: 'SPHERE_NIP44_DECRYPT_RESPONSE',
      success: true,
      plaintext,
    };
  } catch (error) {
    return {
      type: 'SPHERE_NIP44_DECRYPT_RESPONSE',
      success: false,
      error: (error as Error).message,
    };
  }
}

async function handleSignNostrEventRequest(
  _requestId: string,
  origin: string,
  _tabId: number,
  eventHash: string
): Promise<{ type: string; success: boolean; signature?: string; error?: string }> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const signature = walletManager.signNostrEventHash(eventHash);
    return {
      type: 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE',
      success: true,
      signature,
    };
  } catch (error) {
    return {
      type: 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE',
      success: false,
      error: (error as Error).message || 'Failed to sign event',
    };
  }
}

async function handleResolveNametag(
  origin: string,
  nametag: string
): Promise<{
  type: string;
  success: boolean;
  resolution?: { nametag: string; pubkey: string; proxyAddress: string } | null;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_RESOLVE_NAMETAG_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_RESOLVE_NAMETAG_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const resolution = await walletManager.resolveNametag(nametag);
    return {
      type: 'SPHERE_RESOLVE_NAMETAG_RESPONSE',
      success: true,
      resolution,
    };
  } catch (error) {
    return {
      type: 'SPHERE_RESOLVE_NAMETAG_RESPONSE',
      success: false,
      error: (error as Error).message,
    };
  }
}

async function handleCheckNametagAvailable(
  origin: string,
  nametag: string
): Promise<{
  type: string;
  success: boolean;
  available?: boolean;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const available = await walletManager.isNametagAvailable(nametag);
    return {
      type: 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE',
      success: true,
      available,
    };
  } catch (error) {
    return {
      type: 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE',
      success: false,
      error: (error as Error).message,
    };
  }
}

// ============ Popup Nametag Handlers ============

async function handlePopupCheckNametagAvailable(
  nametag: string
): Promise<{ success: boolean; available?: boolean; error?: string }> {
  if (!walletManager.isUnlocked()) {
    return { success: false, error: 'Wallet is locked' };
  }

  try {
    const available = await nametagMintService.isAvailable(nametag);
    return { success: true, available };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to check nametag availability',
    };
  }
}

async function handlePopupRegisterNametag(
  nametag: string
): Promise<{ success: boolean; nametag?: NametagInfo; error?: string }> {
  if (!walletManager.isUnlocked()) {
    return { success: false, error: 'Wallet is locked' };
  }

  try {
    const cleanTag = nametag.replace('@', '').trim().toLowerCase();
    console.log(`[NametagHandler] Registering nametag: @${cleanTag}`);

    const result = await nametagMintService.register(cleanTag);

    if (result.status === 'error') {
      return { success: false, error: result.message };
    }

    const nametagInfo: NametagInfo = {
      nametag: cleanTag,
      proxyAddress: result.proxyAddress,
      tokenId: '',
      status: 'active',
    };

    console.log(`[NametagHandler] Nametag registered: @${cleanTag}`);
    return { success: true, nametag: nametagInfo };
  } catch (error) {
    console.error('[NametagHandler] Registration error:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to register nametag',
    };
  }
}

async function handlePopupGetMyNametag(): Promise<{
  success: boolean;
  nametag?: NametagInfo | null;
  error?: string;
}> {
  if (!walletManager.isUnlocked()) {
    return { success: false, error: 'Wallet is locked' };
  }

  try {
    const nametag = await walletManager.getMyNametag();
    return { success: true, nametag };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to get nametag',
    };
  }
}

async function handleGetMyNametag(
  origin: string
): Promise<{
  type: string;
  success: boolean;
  nametag?: NametagInfo | null;
  error?: string;
}> {
  if (!connectedSites.has(origin)) {
    return {
      type: 'SPHERE_GET_MY_NAMETAG_RESPONSE',
      success: false,
      error: 'Not connected. Call connect() first.',
    };
  }

  if (!walletManager.isUnlocked()) {
    return {
      type: 'SPHERE_GET_MY_NAMETAG_RESPONSE',
      success: false,
      error: 'Wallet is locked.',
    };
  }

  try {
    const nametag = await walletManager.getMyNametag();
    return {
      type: 'SPHERE_GET_MY_NAMETAG_RESPONSE',
      success: true,
      nametag,
    };
  } catch (error) {
    return {
      type: 'SPHERE_GET_MY_NAMETAG_RESPONSE',
      success: false,
      error: (error as Error).message || 'Failed to get nametag',
    };
  }
}

async function handlePopupGetAggregatorConfig(): Promise<{
  success: boolean;
  config?: { gatewayUrl: string; apiKey?: string };
  error?: string;
}> {
  try {
    const config = await walletManager.getAggregatorConfig();
    return { success: true, config };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to get aggregator config',
    };
  }
}

async function handlePopupSetAggregatorConfig(config: {
  gatewayUrl: string;
  apiKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await walletManager.setAggregatorConfig(config);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to set aggregator config',
    };
  }
}

async function handlePopupSendTokens(
  recipient: string,
  coinId: string,
  amount: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const result = await walletManager.sendAmount(coinId, amount, recipient);
    return {
      success: true,
      transactionId: result.transactionId,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to send tokens',
    };
  }
}

async function handlePopupResolveNametag(
  nametag: string
): Promise<{ success: boolean; resolution?: { nametag: string; pubkey: string; proxyAddress: string } | null; error?: string }> {
  try {
    const resolution = await walletManager.resolveNametag(nametag);
    return {
      success: true,
      resolution,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || 'Failed to resolve nametag',
    };
  }
}

// ============ Transaction Approval/Rejection ============

async function handleApproveTransaction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const tx = await removePendingTransaction(requestId);

  if (!tx) {
    return { success: false, error: 'Transaction not found' };
  }

  try {
    let result: unknown;

    switch (tx.type) {
      case 'send': {
        const data = tx.data as SendTransactionData;
        result = await walletManager.sendAmount(data.coinId, data.amount, data.recipient);
        break;
      }

      case 'sign_message': {
        const data = tx.data as SignMessageData;
        const signature = walletManager.signMessageWithIdentity(data.message);
        result = { signature };
        break;
      }

      case 'sign_nostr': {
        const data = tx.data as SignNostrData;
        const signature = walletManager.signNostrEventHash(data.eventHash);
        result = { signature };
        break;
      }
    }

    await sendToTab(tx.tabId, {
      type: 'SPHERE_TRANSACTION_RESULT',
      requestId,
      success: true,
      result,
    });

    return { success: true };
  } catch (error) {
    await sendToTab(tx.tabId, {
      type: 'SPHERE_TRANSACTION_RESULT',
      requestId,
      success: false,
      error: (error as Error).message,
    });

    return { success: false, error: (error as Error).message };
  }
}

async function handleRejectTransaction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const tx = await removePendingTransaction(requestId);

  if (!tx) {
    return { success: false, error: 'Transaction not found' };
  }

  await sendToTab(tx.tabId, {
    type: 'SPHERE_TRANSACTION_RESULT',
    requestId,
    success: false,
    error: 'User rejected the request',
  });

  return { success: true };
}

// ============ Helpers ============

async function openPopup(): Promise<void> {
  try {
    await chrome.action.openPopup();
  } catch {
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 380,
      height: 600,
    });
  }
}

async function sendToTab(tabId: number, message: unknown): Promise<void> {
  if (tabId === 0) {
    console.warn('Cannot send to tab 0');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error('Failed to send message to tab:', error);
  }
}

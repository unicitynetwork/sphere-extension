/**
 * Chrome storage utilities for Sphere extension.
 *
 * Handles:
 * - Pending transactions
 * - User preferences
 * - Session data
 */

import type {
  PendingTransaction,
  UserPreferences,
} from '@/shared/types';
import { DEFAULT_AUTO_LOCK_TIMEOUT } from '@/shared/constants';

/**
 * Default user preferences.
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  autoLockTimeout: DEFAULT_AUTO_LOCK_TIMEOUT,
  showBalanceInPopup: true,
};

// ============ Wallet Storage ============

/**
 * Check if a wallet exists in storage.
 */
export async function hasWallet(): Promise<boolean> {
  const result = await chrome.storage.local.get(['encryptedWallet']);
  return !!result.encryptedWallet;
}

/**
 * Get encrypted wallet JSON from storage.
 */
export async function getEncryptedWallet(): Promise<string | null> {
  const result = await chrome.storage.local.get(['encryptedWallet']);
  return result.encryptedWallet ?? null;
}

/**
 * Save encrypted wallet JSON to storage.
 */
export async function saveEncryptedWallet(walletJson: string): Promise<void> {
  await chrome.storage.local.set({ encryptedWallet: walletJson });
}

/**
 * Delete wallet from storage.
 */
export async function deleteWallet(): Promise<void> {
  await chrome.storage.local.remove(['encryptedWallet']);
}

// ============ Pending Transactions ============

/**
 * Get all pending transactions.
 */
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const result = await chrome.storage.local.get(['pendingTransactions']);
  return result.pendingTransactions ?? [];
}

/**
 * Add a pending transaction.
 */
export async function addPendingTransaction(tx: PendingTransaction): Promise<void> {
  const transactions = await getPendingTransactions();
  transactions.push(tx);
  await chrome.storage.local.set({ pendingTransactions: transactions });
}

/**
 * Remove a pending transaction by request ID.
 */
export async function removePendingTransaction(requestId: string): Promise<PendingTransaction | null> {
  const transactions = await getPendingTransactions();
  const index = transactions.findIndex((tx) => tx.requestId === requestId);

  if (index === -1) {
    return null;
  }

  const [removed] = transactions.splice(index, 1);
  await chrome.storage.local.set({ pendingTransactions: transactions });
  return removed ?? null;
}

/**
 * Get a pending transaction by request ID.
 */
export async function getPendingTransaction(requestId: string): Promise<PendingTransaction | null> {
  const transactions = await getPendingTransactions();
  return transactions.find((tx) => tx.requestId === requestId) ?? null;
}

/**
 * Clear all pending transactions.
 */
export async function clearPendingTransactions(): Promise<void> {
  await chrome.storage.local.set({ pendingTransactions: [] });
}

// ============ User Preferences ============

/**
 * Get user preferences.
 */
export async function getPreferences(): Promise<UserPreferences> {
  const result = await chrome.storage.local.get(['preferences']);
  return { ...DEFAULT_PREFERENCES, ...result.preferences };
}

/**
 * Save user preferences.
 */
export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  const current = await getPreferences();
  await chrome.storage.local.set({
    preferences: { ...current, ...prefs },
  });
}

// ============ Storage Change Listeners ============

/**
 * Listen for pending transaction changes.
 */
export function onPendingTransactionsChange(
  callback: (transactions: PendingTransaction[]) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes.pendingTransactions) {
      callback(changes.pendingTransactions.newValue ?? []);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Clear all extension data (for testing/reset).
 */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

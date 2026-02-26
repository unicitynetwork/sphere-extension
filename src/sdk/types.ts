// Re-export SDK types that UI components need
export type { Asset, Token, TransactionHistoryEntry } from '@unicitylabs/sphere-sdk';
export type { TokenBalance, IdentityInfo, WalletState, NametagInfo, NametagResolution, PendingTransaction, SendTransactionData, SignMessageData, SignNostrData, AggregatorConfig } from '@/shared/types';

// Identity type used by UI
export interface WalletIdentity {
  chainPubkey: string;
  l1Address: string;
  directAddress?: string;
  nametag?: string;
}

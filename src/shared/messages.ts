/**
 * Message helper functions and constants.
 */

import type { SphereRequestType, SphereResponseType } from './types';

/** Prefix for all Sphere messages to avoid collisions */
export const MESSAGE_PREFIX = 'SPHERE_';

// ============ POPUP_* Message Type Constants ============
// Use these instead of raw string literals in both popup UI and message-handler.

export const POPUP_MESSAGES = {
  // Wallet state
  GET_STATE: 'POPUP_GET_STATE',
  CREATE_WALLET: 'POPUP_CREATE_WALLET',
  IMPORT_WALLET: 'POPUP_IMPORT_WALLET',
  UNLOCK_WALLET: 'POPUP_UNLOCK_WALLET',
  LOCK_WALLET: 'POPUP_LOCK_WALLET',
  RESET_WALLET: 'POPUP_RESET_WALLET',
  EXPORT_WALLET: 'POPUP_EXPORT_WALLET',
  GET_MNEMONIC: 'POPUP_GET_MNEMONIC',

  // Identity & addresses
  GET_IDENTITIES: 'POPUP_GET_IDENTITIES',
  GET_IDENTITY: 'POPUP_GET_IDENTITY',
  GET_ADDRESS: 'POPUP_GET_ADDRESS',

  // Balances & tokens
  GET_BALANCES: 'POPUP_GET_BALANCES',
  GET_ASSETS: 'POPUP_GET_ASSETS',
  GET_TOKENS: 'POPUP_GET_TOKENS',
  GET_TRANSACTION_HISTORY: 'POPUP_GET_TRANSACTION_HISTORY',
  CHECK_TOKEN_HEALTH: 'POPUP_CHECK_TOKEN_HEALTH',
  PURGE_INVALID_TOKENS: 'POPUP_PURGE_INVALID_TOKENS',
  FINALIZE_TOKENS: 'POPUP_FINALIZE_TOKENS',

  // Sending
  SEND_TOKENS: 'POPUP_SEND_TOKENS',

  // Pending transactions (legacy window.sphere API flow)
  GET_PENDING_TRANSACTIONS: 'POPUP_GET_PENDING_TRANSACTIONS',
  APPROVE_TRANSACTION: 'POPUP_APPROVE_TRANSACTION',
  REJECT_TRANSACTION: 'POPUP_REJECT_TRANSACTION',

  // Nostr
  GET_NOSTR_PUBLIC_KEY: 'POPUP_GET_NOSTR_PUBLIC_KEY',

  // Nametag
  CHECK_NAMETAG_AVAILABLE: 'POPUP_CHECK_NAMETAG_AVAILABLE',
  REGISTER_NAMETAG: 'POPUP_REGISTER_NAMETAG',
  GET_MY_NAMETAG: 'POPUP_GET_MY_NAMETAG',
  RESOLVE_NAMETAG: 'POPUP_RESOLVE_NAMETAG',

  // Preferences & config
  GET_PREFERENCES: 'POPUP_GET_PREFERENCES',
  SAVE_PREFERENCES: 'POPUP_SAVE_PREFERENCES',
  GET_AGGREGATOR_CONFIG: 'POPUP_GET_AGGREGATOR_CONFIG',
  SET_AGGREGATOR_CONFIG: 'POPUP_SET_AGGREGATOR_CONFIG',

  // Connect Protocol — approval flow
  GET_CONNECT_APPROVAL: 'POPUP_GET_CONNECT_APPROVAL',
  RESOLVE_CONNECT_APPROVAL: 'POPUP_RESOLVE_CONNECT_APPROVAL',

  // Connect Protocol — intent flow
  GET_CONNECT_INTENT: 'POPUP_GET_CONNECT_INTENT',
  RESOLVE_CONNECT_INTENT: 'POPUP_RESOLVE_CONNECT_INTENT',

  // Connect Protocol — connected sites
  GET_CONNECTED_SITES: 'POPUP_GET_CONNECTED_SITES',
  REVOKE_CONNECTED_SITE: 'POPUP_REVOKE_CONNECTED_SITE',

  // Connect Protocol — communications & L1 (via intent handler)
  SEND_DM: 'POPUP_SEND_DM',
  SEND_L1_TOKENS: 'POPUP_SEND_L1_TOKENS',
  GET_L1_VESTING_BALANCES: 'POPUP_GET_L1_VESTING_BALANCES',
  SEND_PAYMENT_REQUEST: 'POPUP_SEND_PAYMENT_REQUEST',
  SIGN_MESSAGE_CONNECT: 'POPUP_SIGN_MESSAGE_CONNECT',
  SET_DM_AUTO_APPROVE: 'POPUP_SET_DM_AUTO_APPROVE',
} as const;

/** Timeout for requests (30 seconds) */
export const REQUEST_TIMEOUT = 30000;

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if a message type is a Sphere request.
 */
export function isSphereRequest(type: string): type is SphereRequestType {
  return type.startsWith(MESSAGE_PREFIX) && !type.endsWith('_RESPONSE') && !type.includes('_RESULT');
}

/**
 * Check if a message type is a Sphere response.
 */
export function isSphereResponse(type: string): type is SphereResponseType {
  return type.startsWith(MESSAGE_PREFIX) && (type.endsWith('_RESPONSE') || type.includes('_RESULT'));
}

/**
 * Get the response type for a request type.
 */
export function getResponseType(requestType: SphereRequestType): SphereResponseType {
  return `${requestType}_RESPONSE` as SphereResponseType;
}

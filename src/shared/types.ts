/**
 * Shared types for Sphere browser extension.
 */

// ============ Wallet State Types ============

export interface WalletState {
  /** Whether a wallet exists in storage */
  hasWallet: boolean;
  /** Whether the wallet is currently unlocked */
  isUnlocked: boolean;
  /** The active identity ID (if unlocked) */
  activeIdentityId: string | null;
}

export interface IdentityInfo {
  /** Unique identity ID */
  id: string;
  /** Human-readable label */
  label: string;
  /** Hex-encoded public key (33 bytes compressed secp256k1) */
  publicKey: string;
  /** ISO timestamp when created */
  createdAt: string;
}

export interface TokenBalance {
  /** Hex-encoded coin ID */
  coinId: string;
  /** Symbol for display (e.g., 'ALPHA') */
  symbol: string;
  /** Balance amount as string (to handle bigint) */
  amount: string;
}

// ============ Nametag Types ============

export interface NametagInfo {
  /** Nametag name (e.g., "alice") */
  nametag: string;
  /** Deterministic proxy address for receiving */
  proxyAddress: string;
  /** On-chain nametag token ID */
  tokenId: string;
  /** Current status */
  status: 'active' | 'minting' | 'pending';
}

export interface NametagResolution {
  /** Nametag name */
  nametag: string;
  /** Owner's NOSTR public key */
  pubkey: string;
  /** Proxy address for sending tokens */
  proxyAddress: string;
}

export interface SendTokensResult {
  /** Generated transaction ID for tracking */
  transactionId: string;
  /** JSON payload to send to recipient (for receiveAmount) */
  recipientPayload: string;
  /** Actual amount sent (as string) */
  sent: string;
  /** Number of tokens used in the transfer */
  tokensUsed: number;
  /** Whether a split was performed */
  splitPerformed: boolean;
}

export interface PendingTransaction {
  /** Unique request ID for matching responses */
  requestId: string;
  /** Type of transaction */
  type: 'send' | 'sign_message' | 'sign_nostr';
  /** Origin URL of requesting page */
  origin: string;
  /** Tab ID that initiated the request */
  tabId: number;
  /** Timestamp when request was created */
  timestamp: number;
  /** Transaction-specific data */
  data: SendTransactionData | SignMessageData | SignNostrData;
}

export interface SendTransactionData {
  /** Recipient address */
  recipient: string;
  /** Hex-encoded coin ID */
  coinId: string;
  /** Amount to send as string */
  amount: string;
  /** Optional message */
  message?: string;
}

export interface SignMessageData {
  /** Message to sign */
  message: string;
}

export interface SignNostrData {
  /** Event hash to sign (hex) */
  eventHash: string;
}

// ============ Storage Schema Types ============

export interface StorageSchema {
  /** Encrypted wallet JSON */
  encryptedWallet?: string;
  /** Salt for password derivation (hex) */
  walletSalt?: string;
  /** Pending transactions awaiting approval */
  pendingTransactions?: PendingTransaction[];
  /** User preferences */
  preferences?: UserPreferences;
  /** Session data (cleared on lock) */
  session?: SessionData;
}

export interface UserPreferences {
  /** Auto-lock timeout in minutes (0 = never) */
  autoLockTimeout: number;
  /** Show balance in popup */
  showBalanceInPopup: boolean;
}

export interface SessionData {
  /** Derived encryption key (hex) - only stored while unlocked */
  encryptionKey?: string;
  /** Cached wallet JSON (decrypted) - only stored while unlocked */
  walletJson?: string;
}

// ============ Message Types ============

/** Message types from inject script to content script */
export type SphereRequestType =
  | 'SPHERE_CONNECT'
  | 'SPHERE_DISCONNECT'
  | 'SPHERE_GET_ACTIVE_IDENTITY'
  | 'SPHERE_GET_BALANCES'
  | 'SPHERE_SEND_TOKENS'
  | 'SPHERE_SIGN_MESSAGE'
  | 'SPHERE_GET_NOSTR_PUBLIC_KEY'
  | 'SPHERE_SIGN_NOSTR_EVENT'
  | 'SPHERE_RESOLVE_NAMETAG'
  | 'SPHERE_MINT_NAMETAG'
  | 'SPHERE_GET_MY_NAMETAGS'
  | 'SPHERE_CHECK_NAMETAG_AVAILABLE';

/** Message types from background to content/inject */
export type SphereResponseType =
  | 'SPHERE_CONNECT_RESPONSE'
  | 'SPHERE_DISCONNECT_RESPONSE'
  | 'SPHERE_GET_ACTIVE_IDENTITY_RESPONSE'
  | 'SPHERE_GET_BALANCES_RESPONSE'
  | 'SPHERE_SEND_TOKENS_RESPONSE'
  | 'SPHERE_SIGN_MESSAGE_RESPONSE'
  | 'SPHERE_GET_NOSTR_PUBLIC_KEY_RESPONSE'
  | 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE'
  | 'SPHERE_TRANSACTION_RESULT'
  | 'SPHERE_RESOLVE_NAMETAG_RESPONSE'
  | 'SPHERE_MINT_NAMETAG_RESPONSE'
  | 'SPHERE_GET_MY_NAMETAGS_RESPONSE'
  | 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE';

/** Message types from popup to background */
export type PopupMessageType =
  | 'POPUP_GET_STATE'
  | 'POPUP_CREATE_WALLET'
  | 'POPUP_IMPORT_WALLET'
  | 'POPUP_UNLOCK_WALLET'
  | 'POPUP_LOCK_WALLET'
  | 'POPUP_GET_IDENTITIES'
  | 'POPUP_CREATE_IDENTITY'
  | 'POPUP_SWITCH_IDENTITY'
  | 'POPUP_REMOVE_IDENTITY'
  | 'POPUP_GET_BALANCES'
  | 'POPUP_EXPORT_WALLET'
  | 'POPUP_GET_PENDING_TRANSACTIONS'
  | 'POPUP_APPROVE_TRANSACTION'
  | 'POPUP_REJECT_TRANSACTION'
  | 'POPUP_GET_NOSTR_PUBLIC_KEY'
  | 'POPUP_GET_ADDRESS'
  | 'POPUP_CHECK_NAMETAG_AVAILABLE'
  | 'POPUP_REGISTER_NAMETAG'
  | 'POPUP_GET_MY_NAMETAG';

// ============ Request/Response Types ============

export interface BaseRequest {
  requestId: string;
}

export interface BaseResponse {
  requestId: string;
  success: boolean;
  error?: string;
}

// Connect
export interface ConnectRequest extends BaseRequest {
  type: 'SPHERE_CONNECT';
}

export interface ConnectResponse extends BaseResponse {
  type: 'SPHERE_CONNECT_RESPONSE';
  identity?: IdentityInfo;
}

// Disconnect
export interface DisconnectRequest extends BaseRequest {
  type: 'SPHERE_DISCONNECT';
}

export interface DisconnectResponse extends BaseResponse {
  type: 'SPHERE_DISCONNECT_RESPONSE';
}

// Get Active Identity
export interface GetActiveIdentityRequest extends BaseRequest {
  type: 'SPHERE_GET_ACTIVE_IDENTITY';
}

export interface GetActiveIdentityResponse extends BaseResponse {
  type: 'SPHERE_GET_ACTIVE_IDENTITY_RESPONSE';
  identity?: IdentityInfo | null;
}

// Get Balances
export interface GetBalancesRequest extends BaseRequest {
  type: 'SPHERE_GET_BALANCES';
}

export interface GetBalancesResponse extends BaseResponse {
  type: 'SPHERE_GET_BALANCES_RESPONSE';
  balances?: TokenBalance[];
}

// Send Tokens
export interface SendTokensRequest extends BaseRequest {
  type: 'SPHERE_SEND_TOKENS';
  recipient: string;
  coinId: string;
  amount: string;
  message?: string;
}

export interface SendTokensResponse extends BaseResponse {
  type: 'SPHERE_SEND_TOKENS_RESPONSE';
  transactionId?: string;
}

// Sign Message
export interface SignMessageRequest extends BaseRequest {
  type: 'SPHERE_SIGN_MESSAGE';
  message: string;
}

export interface SignMessageResponse extends BaseResponse {
  type: 'SPHERE_SIGN_MESSAGE_RESPONSE';
  signature?: string;
}

// NOSTR Public Key
export interface GetNostrPublicKeyRequest extends BaseRequest {
  type: 'SPHERE_GET_NOSTR_PUBLIC_KEY';
}

export interface GetNostrPublicKeyResponse extends BaseResponse {
  type: 'SPHERE_GET_NOSTR_PUBLIC_KEY_RESPONSE';
  publicKey?: string;
  npub?: string;
}

// Sign NOSTR Event
export interface SignNostrEventRequest extends BaseRequest {
  type: 'SPHERE_SIGN_NOSTR_EVENT';
  eventHash: string;
}

export interface SignNostrEventResponse extends BaseResponse {
  type: 'SPHERE_SIGN_NOSTR_EVENT_RESPONSE';
  signature?: string;
}

// Transaction Result (pushed from background after approval)
export interface TransactionResultMessage {
  type: 'SPHERE_TRANSACTION_RESULT';
  requestId: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

// ============ Popup Message Types ============

export interface PopupGetStateResponse extends BaseResponse {
  state?: WalletState;
}

export interface PopupCreateWalletRequest {
  type: 'POPUP_CREATE_WALLET';
  password: string;
  walletName?: string;
  identityLabel?: string;
}

export interface PopupImportWalletRequest {
  type: 'POPUP_IMPORT_WALLET';
  walletJson: string;
  password: string;
}

export interface PopupUnlockWalletRequest {
  type: 'POPUP_UNLOCK_WALLET';
  password: string;
}

export interface PopupCreateIdentityRequest {
  type: 'POPUP_CREATE_IDENTITY';
  label: string;
}

export interface PopupSwitchIdentityRequest {
  type: 'POPUP_SWITCH_IDENTITY';
  identityId: string;
}

export interface PopupRemoveIdentityRequest {
  type: 'POPUP_REMOVE_IDENTITY';
  identityId: string;
}

export interface PopupApproveTransactionRequest {
  type: 'POPUP_APPROVE_TRANSACTION';
  requestId: string;
}

export interface PopupRejectTransactionRequest {
  type: 'POPUP_REJECT_TRANSACTION';
  requestId: string;
}

export interface PopupGetAddressRequest {
  type: 'POPUP_GET_ADDRESS';
  coinId: string;
}

export interface PopupGetAddressResponse extends BaseResponse {
  address?: string;
}

// ============ Nametag Request/Response Types ============

// Resolve Nametag
export interface ResolveNametagRequest extends BaseRequest {
  type: 'SPHERE_RESOLVE_NAMETAG';
  nametag: string;
}

export interface ResolveNametagResponse extends BaseResponse {
  type: 'SPHERE_RESOLVE_NAMETAG_RESPONSE';
  resolution?: NametagResolution | null;
}

// Check Nametag Available
export interface CheckNametagAvailableRequest extends BaseRequest {
  type: 'SPHERE_CHECK_NAMETAG_AVAILABLE';
  nametag: string;
}

export interface CheckNametagAvailableResponse extends BaseResponse {
  type: 'SPHERE_CHECK_NAMETAG_AVAILABLE_RESPONSE';
  available?: boolean;
}

// Mint Nametag
export interface MintNametagRequest extends BaseRequest {
  type: 'SPHERE_MINT_NAMETAG';
  nametag: string;
}

export interface MintNametagResponse extends BaseResponse {
  type: 'SPHERE_MINT_NAMETAG_RESPONSE';
  nametag?: NametagInfo;
}

// Get My Nametags
export interface GetMyNametagsRequest extends BaseRequest {
  type: 'SPHERE_GET_MY_NAMETAGS';
}

export interface GetMyNametagsResponse extends BaseResponse {
  type: 'SPHERE_GET_MY_NAMETAGS_RESPONSE';
  nametags?: NametagInfo[];
}

// ============ Popup Nametag Types ============

// Check Nametag Available (Popup)
export interface PopupCheckNametagAvailableRequest {
  type: 'POPUP_CHECK_NAMETAG_AVAILABLE';
  nametag: string;
}

export interface PopupCheckNametagAvailableResponse extends BaseResponse {
  available?: boolean;
}

// Register Nametag (Popup)
export interface PopupRegisterNametagRequest {
  type: 'POPUP_REGISTER_NAMETAG';
  nametag: string;
}

export interface PopupRegisterNametagResponse extends BaseResponse {
  nametag?: NametagInfo;
}

// Get My Nametag (Popup)
export interface PopupGetMyNametagRequest {
  type: 'POPUP_GET_MY_NAMETAG';
}

export interface PopupGetMyNametagResponse extends BaseResponse {
  nametag?: NametagInfo | null;
}

// Stored nametag in chrome.storage
export interface StoredNametag {
  name: string;
  tokenJson: string;
  proxyAddress: string;
  timestamp: number;
}

// ============ Union Types ============

export type SphereRequest =
  | ConnectRequest
  | DisconnectRequest
  | GetActiveIdentityRequest
  | GetBalancesRequest
  | SendTokensRequest
  | SignMessageRequest
  | GetNostrPublicKeyRequest
  | SignNostrEventRequest
  | ResolveNametagRequest
  | CheckNametagAvailableRequest
  | MintNametagRequest
  | GetMyNametagsRequest;

export type SphereResponse =
  | ConnectResponse
  | DisconnectResponse
  | GetActiveIdentityResponse
  | GetBalancesResponse
  | SendTokensResponse
  | SignMessageResponse
  | GetNostrPublicKeyResponse
  | SignNostrEventResponse
  | TransactionResultMessage
  | ResolveNametagResponse
  | CheckNametagAvailableResponse
  | MintNametagResponse
  | GetMyNametagsResponse;

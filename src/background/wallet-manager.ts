/**
 * Wallet Manager - wraps Alphalite Wallet for extension use.
 *
 * Handles:
 * - Wallet creation with password encryption
 * - Wallet import from JSON
 * - Unlock/lock operations
 * - Multi-identity management
 * - Balance queries
 */

import { Wallet, Identity, AlphaClient } from '@jvsteiner/alphalite';
import type { IWalletJson } from '@jvsteiner/alphalite';
import { ProxyAddress } from '@unicitylabs/state-transition-sdk/lib/address/ProxyAddress';
import type { IdentityInfo, TokenBalance, WalletState, SendTokensResult, NametagResolution, StoredNametag, NametagInfo } from '@/shared/types';
import { COIN_SYMBOLS, ALPHA_COIN_ID, GATEWAY_URL } from '@/shared/constants';
import { deriveNostrKeyPair, signNostrEvent, signMessage } from './nostr-keys';
import { nostrService } from './nostr-service';
import { TokenTransferService } from './token-transfer-service';

/**
 * In-memory wallet state (cleared on lock or extension restart)
 */
interface UnlockedWallet {
  wallet: Wallet;
  password: string;
}

/**
 * WalletManager provides a high-level interface for wallet operations.
 */
export class WalletManager {
  private unlockedWallet: UnlockedWallet | null = null;
  private alphaClient: AlphaClient | null = null;

  /**
   * Get the current wallet state.
   */
  async getState(): Promise<WalletState> {
    const result = await chrome.storage.local.get(['encryptedWallet']);

    return {
      hasWallet: !!result.encryptedWallet,
      isUnlocked: this.unlockedWallet !== null,
      activeIdentityId: this.unlockedWallet?.wallet.getDefaultIdentity().id ?? null,
    };
  }

  /**
   * Create a new wallet with the given password.
   */
  async createWallet(password: string, name?: string, identityLabel?: string): Promise<IdentityInfo> {
    // Create new wallet
    const wallet = await Wallet.create({
      name: name ?? 'Sphere Wallet',
      identityLabel: identityLabel ?? 'Default',
    });

    // Export and encrypt with password
    const walletJson = wallet.toJSON({ password });

    // Save to storage
    await chrome.storage.local.set({
      encryptedWallet: JSON.stringify(walletJson),
    });

    // Keep wallet unlocked in memory
    this.unlockedWallet = { wallet, password };

    // Connect to NOSTR relay
    await this.connectNostr();

    // Return the default identity info
    return this.identityToInfo(wallet.getDefaultIdentity());
  }

  /**
   * Import wallet from JSON string.
   */
  async importWallet(walletJsonStr: string, password: string): Promise<IdentityInfo> {
    const walletJson = JSON.parse(walletJsonStr) as IWalletJson;

    // Import with password decryption
    const wallet = await Wallet.fromJSON(walletJson, { password });

    // Re-export with password to ensure consistent encryption
    const reExportedJson = wallet.toJSON({ password });

    // Save to storage
    await chrome.storage.local.set({
      encryptedWallet: JSON.stringify(reExportedJson),
    });

    // Keep wallet unlocked in memory
    this.unlockedWallet = { wallet, password };

    // Connect to NOSTR relay
    await this.connectNostr();

    return this.identityToInfo(wallet.getDefaultIdentity());
  }

  /**
   * Unlock the wallet with password.
   */
  async unlock(password: string): Promise<IdentityInfo> {
    const result = await chrome.storage.local.get(['encryptedWallet']);

    if (!result.encryptedWallet) {
      throw new Error('No wallet found');
    }

    const walletJson = JSON.parse(result.encryptedWallet) as IWalletJson;

    // This will throw if password is wrong
    const wallet = await Wallet.fromJSON(walletJson, { password });

    this.unlockedWallet = { wallet, password };

    // Connect to NOSTR relay
    await this.connectNostr();

    return this.identityToInfo(wallet.getDefaultIdentity());
  }

  /**
   * Lock the wallet (clear from memory).
   */
  async lock(): Promise<void> {
    // Disconnect from NOSTR relay
    await nostrService.disconnect();

    this.unlockedWallet = null;
    this.alphaClient = null;
  }

  /**
   * Check if wallet is unlocked.
   */
  isUnlocked(): boolean {
    return this.unlockedWallet !== null;
  }

  /**
   * Get the unlocked wallet (throws if locked).
   */
  private getWallet(): Wallet {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }
    return this.unlockedWallet.wallet;
  }

  /**
   * Save the current wallet state to storage.
   */
  private async saveWallet(): Promise<void> {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    const walletJson = this.unlockedWallet.wallet.toJSON({
      password: this.unlockedWallet.password,
    });

    await chrome.storage.local.set({
      encryptedWallet: JSON.stringify(walletJson),
    });
  }

  // ============ Identity Management ============

  /**
   * Get the active (default) identity.
   */
  getActiveIdentity(): IdentityInfo {
    const wallet = this.getWallet();
    return this.identityToInfo(wallet.getDefaultIdentity());
  }

  /**
   * List all identities.
   */
  listIdentities(): IdentityInfo[] {
    const wallet = this.getWallet();
    return wallet.listIdentities().map((id) => this.identityToInfo(id));
  }

  /**
   * Create a new identity.
   */
  async createIdentity(label: string): Promise<IdentityInfo> {
    const wallet = this.getWallet();
    const identity = await wallet.createIdentity({ label });
    await this.saveWallet();
    return this.identityToInfo(identity);
  }

  /**
   * Switch the active identity.
   */
  async switchIdentity(identityId: string): Promise<IdentityInfo> {
    const wallet = this.getWallet();
    wallet.setDefaultIdentity(identityId);
    await this.saveWallet();
    return this.identityToInfo(wallet.getDefaultIdentity());
  }

  /**
   * Remove an identity.
   */
  async removeIdentity(identityId: string): Promise<void> {
    const wallet = this.getWallet();
    wallet.removeIdentity(identityId);
    await this.saveWallet();
  }

  /**
   * Get identity by ID.
   */
  getIdentity(identityId: string): Identity | undefined {
    const wallet = this.getWallet();
    return wallet.getIdentity(identityId);
  }

  // ============ Balance Methods ============

  /**
   * Get all token balances for the active identity.
   */
  getBalances(): TokenBalance[] {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    const balanceMap = wallet.getBalances(activeIdentity.id);

    const balances: TokenBalance[] = [];

    // Always include ALPHA even if balance is 0
    const alphaBalance = balanceMap.get(ALPHA_COIN_ID) ?? 0n;
    balances.push({
      coinId: ALPHA_COIN_ID,
      symbol: COIN_SYMBOLS[ALPHA_COIN_ID] ?? 'ALPHA',
      amount: alphaBalance.toString(),
    });

    // Add other coins
    for (const [coinId, amount] of balanceMap) {
      if (coinId === ALPHA_COIN_ID) continue;
      balances.push({
        coinId,
        symbol: COIN_SYMBOLS[coinId] ?? coinId.slice(0, 8).toUpperCase(),
        amount: amount.toString(),
      });
    }

    return balances;
  }

  /**
   * Get balance for a specific coin.
   */
  getBalance(coinId: string): bigint {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    return wallet.getBalance(coinId, activeIdentity.id);
  }

  /**
   * Check if wallet can afford an amount.
   */
  canAfford(coinId: string, amount: bigint): boolean {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    return wallet.canAfford(coinId, amount, activeIdentity.id);
  }

  // ============ Address Methods ============

  /**
   * Get the receive address for the active identity.
   */
  async getAddress(tokenType?: Uint8Array): Promise<string> {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    return wallet.getAddress(activeIdentity.id, tokenType);
  }

  // ============ Token Operations ============

  /**
   * Initialize or get the AlphaClient instance.
   */
  private getAlphaClient(): AlphaClient {
    if (!this.alphaClient) {
      this.alphaClient = new AlphaClient({
        gatewayUrl: GATEWAY_URL,
        onWalletStateChange: async () => {
          // Auto-save wallet after blockchain operations
          await this.saveWallet();
        },
      });
    }
    return this.alphaClient;
  }

  /**
   * Send tokens to a recipient.
   *
   * Supports sending to:
   * - Public key (hex string starting with valid hex)
   * - Nametag (e.g., "@alice" or "alice")
   *
   * When sending to a nametag:
   * - Resolves nametag to proxy address
   * - Sends tokens to proxy address
   * - Sends P2P notification via NOSTR to recipient's pubkey
   *
   * @param coinId Hex-encoded coin ID
   * @param amount Amount to send (as string to handle bigint)
   * @param recipient Recipient's public key OR nametag
   * @returns Result containing transaction ID and payload
   */
  async sendAmount(
    coinId: string,
    amount: string,
    recipient: string
  ): Promise<SendTokensResult> {
    const wallet = this.getWallet();
    const client = this.getAlphaClient();
    const amountBigInt = BigInt(amount);

    let recipientAddress: string;
    let recipientPubkey: string | null = null;

    // Check if recipient is a nametag
    const isNametag = recipient.startsWith('@') || !this.isHexString(recipient);

    if (isNametag) {
      // Resolve nametag to proxy address and pubkey
      const resolution = await this.resolveNametag(recipient);
      if (!resolution) {
        const cleanTag = recipient.replace('@', '').trim();
        throw new Error(`Nametag @${cleanTag} not found`);
      }
      recipientAddress = resolution.proxyAddress;
      recipientPubkey = resolution.pubkey;
    } else {
      // Recipient is a direct public key
      recipientAddress = recipient;
    }

    // Send tokens to the address
    const result = await client.sendAmount(
      wallet,
      coinId,
      amountBigInt,
      recipientAddress
    );

    // Save wallet after successful send
    await this.saveWallet();

    // If sending to nametag, send P2P notification via NOSTR
    if (recipientPubkey && nostrService.getIsConnected()) {
      try {
        await nostrService.sendTokenTransfer(
          recipientPubkey,
          result.recipientPayload,
          { amount: amountBigInt, symbol: COIN_SYMBOLS[coinId] ?? 'TOKEN' }
        );
      } catch (error) {
        // Log but don't fail the transaction - tokens are already sent
        console.error('Failed to send NOSTR notification:', error);
      }
    }

    return {
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      recipientPayload: result.recipientPayload,
      sent: result.sent.toString(),
      tokensUsed: result.tokensUsed,
      splitPerformed: result.splitPerformed,
    };
  }

  /**
   * Check if a string is a valid hex string (for public keys/addresses).
   */
  private isHexString(str: string): boolean {
    // Valid hex strings are even length and contain only hex characters
    return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0 && str.length >= 32;
  }

  /**
   * Receive tokens from a sender.
   *
   * @param payloadJson JSON string from sender (from sendAmount result)
   * @returns Array of received token IDs
   */
  async receiveAmount(payloadJson: string): Promise<string[]> {
    const wallet = this.getWallet();
    const client = this.getAlphaClient();

    const tokens = await client.receiveAmount(wallet, payloadJson);

    // Save wallet after successful receive
    await this.saveWallet();

    return tokens.map((t) => t.id);
  }

  // ============ NOSTR Key Operations ============

  /**
   * Get NOSTR public key for the active identity.
   *
   * @returns Object with hex and npub formats
   */
  getNostrPublicKey(): { hex: string; npub: string } {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    const keyPair = deriveNostrKeyPair(activeIdentity);

    return {
      hex: keyPair.publicKeyHex,
      npub: keyPair.npub,
    };
  }

  /**
   * Sign a NOSTR event hash.
   *
   * @param eventHash 32-byte event hash as hex string
   * @returns 64-byte Schnorr signature as hex string
   */
  signNostrEventHash(eventHash: string): string {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    const keyPair = deriveNostrKeyPair(activeIdentity);

    // Convert hex to bytes
    const hashBytes = this.hexToBytes(eventHash);

    return signNostrEvent(keyPair.privateKey, hashBytes);
  }

  /**
   * Sign a message with the active identity.
   *
   * @param message Message string to sign
   * @returns Signature as hex string
   */
  signMessageWithIdentity(message: string): string {
    const wallet = this.getWallet();
    const activeIdentity = wallet.getDefaultIdentity();
    const keyPair = deriveNostrKeyPair(activeIdentity);

    return signMessage(keyPair.privateKey, message);
  }

  // ============ Export ============

  /**
   * Export wallet as encrypted JSON.
   */
  exportWallet(): string {
    if (!this.unlockedWallet) {
      throw new Error('Wallet is locked');
    }

    const walletJson = this.unlockedWallet.wallet.toJSON({
      password: this.unlockedWallet.password,
      includeTokens: true,
    });

    return JSON.stringify(walletJson, null, 2);
  }

  /**
   * Get the raw Wallet instance (for advanced operations).
   */
  getRawWallet(): Wallet {
    return this.getWallet();
  }

  // ============ Nametag Operations ============

  /**
   * Resolve a nametag to its NOSTR pubkey and proxy address.
   *
   * @param nametag Nametag to resolve (with or without @)
   * @returns Resolution info or null if not found
   */
  async resolveNametag(nametag: string): Promise<NametagResolution | null> {
    // Clean the nametag
    const cleanTag = nametag.replace('@unicity', '').replace('@', '').trim();

    // Query NOSTR for the pubkey
    const pubkey = await nostrService.queryPubkeyByNametag(cleanTag);
    if (!pubkey) {
      return null;
    }

    // Derive the proxy address from the nametag
    const proxyAddress = await ProxyAddress.fromNameTag(cleanTag);

    return {
      nametag: cleanTag,
      pubkey,
      proxyAddress: proxyAddress.address,
    };
  }

  // ============ Nametag Storage ============

  /**
   * Get stored nametag from chrome.storage.
   */
  async getStoredNametag(): Promise<StoredNametag | null> {
    const result = await chrome.storage.local.get(['nametag']);
    return result.nametag || null;
  }

  /**
   * Save nametag to chrome.storage.
   */
  async saveNametag(nametag: StoredNametag): Promise<void> {
    await chrome.storage.local.set({ nametag });
  }

  /**
   * Delete nametag from chrome.storage.
   */
  async deleteNametag(): Promise<void> {
    await chrome.storage.local.remove(['nametag']);
  }

  /**
   * Get nametag info for UI display.
   */
  async getMyNametag(): Promise<NametagInfo | null> {
    const stored = await this.getStoredNametag();
    if (!stored) return null;

    return {
      nametag: stored.name,
      proxyAddress: stored.proxyAddress,
      tokenId: '', // Token ID can be derived from the token JSON if needed
      status: 'active',
    };
  }

  // ============ NOSTR Connection ============

  /**
   * Connect to NOSTR relay with the active identity's key.
   * Sets up token transfer handler for receiving tokens via NOSTR.
   */
  private async connectNostr(): Promise<void> {
    if (!this.unlockedWallet) return;

    try {
      const activeIdentity = this.unlockedWallet.wallet.getDefaultIdentity();
      const keyPair = deriveNostrKeyPair(activeIdentity);
      const privateKeyHex = this.bytesToHex(keyPair.privateKey);
      await nostrService.connect(privateKeyHex);

      // Set up token transfer handler
      this.setupTokenTransferHandler();
    } catch (error) {
      console.error('Failed to connect to NOSTR:', error);
      // Don't throw - NOSTR is not critical for basic wallet operation
    }
  }

  /**
   * Set up handler for incoming token transfers via NOSTR.
   */
  private setupTokenTransferHandler(): void {
    const tokenTransferService = new TokenTransferService({
      onTokenReceived: async (tokenJson, transactionJson, senderPubkey) => {
        console.log(`[WalletManager] Receiving token from ${senderPubkey.slice(0, 8)}...`);
        try {
          // Use the existing receiveAmount flow
          // The payload format from NOSTR is: { sourceToken, transferTx }
          // We need to construct the payload that receiveAmount expects
          const payload = JSON.stringify({
            token: JSON.parse(tokenJson),
            transaction: JSON.parse(transactionJson),
          });

          const tokenIds = await this.receiveAmount(payload);
          console.log(`[WalletManager] Received ${tokenIds.length} token(s)`);
          return tokenIds.length > 0;
        } catch (error) {
          console.error('[WalletManager] Token receive failed:', error);
          return false;
        }
      },

      getStoredNametag: async () => {
        return this.getStoredNametag();
      },
    });

    // Register the handler with nostrService
    nostrService.onTokenTransfer(async (transfer) => {
      return tokenTransferService.processTransfer(transfer);
    });

    console.log('[WalletManager] Token transfer handler configured');
  }

  // ============ Helpers ============

  /**
   * Convert Identity to IdentityInfo.
   */
  private identityToInfo(identity: Identity): IdentityInfo {
    return {
      id: identity.id,
      label: identity.label,
      publicKey: this.bytesToHex(identity.publicKey),
      createdAt: identity.createdAt.toISOString(),
    };
  }

  /**
   * Convert bytes to hex string.
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Convert hex string to bytes.
   */
  private hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error('Invalid hex string length');
    }

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }

    return bytes;
  }
}

// Singleton instance
export const walletManager = new WalletManager();

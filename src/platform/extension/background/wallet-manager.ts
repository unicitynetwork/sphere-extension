/**
 * Wallet Manager - wraps Sphere SDK for extension use.
 *
 * Handles:
 * - Wallet creation with BIP39 mnemonic + password encryption
 * - Wallet import from mnemonic
 * - Unlock/lock operations
 * - HD address derivation
 * - Balance queries
 * - Token sending/receiving via SDK
 * - Nametag operations
 */

import { Sphere } from '@unicitylabs/sphere-sdk';
import { NIP44 } from '@unicitylabs/nostr-js-sdk';
import {
  createBrowserProviders,
  type BrowserProviders,
} from '@unicitylabs/sphere-sdk/impl/browser';
import type {
  IdentityInfo,
  TokenBalance,
  TokenHealthInfo,
  TokenHealthResult,
  WalletState,
  SendTokensResult,
  NametagResolution,
  StoredNametag,
  NametagInfo,
} from '@/shared/types';
import { COIN_SYMBOLS, COIN_DECIMALS, DEFAULT_DECIMALS, ALPHA_COIN_ID } from '@/shared/constants';
import { deriveNostrKeyPair, signNostrEvent, signMessage } from './nostr-keys';
import { Token as SdkToken } from '@unicitylabs/state-transition-sdk/lib/token/Token';
import { PredicateEngineService } from '@unicitylabs/state-transition-sdk/lib/predicate/PredicateEngineService';

// Storage key for the encrypted mnemonic
const ENCRYPTED_MNEMONIC_KEY = 'encryptedMnemonic';


// ============ Mnemonic Encryption (SubtleCrypto) ============

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(mnemonic),
  );
  // Pack salt + iv + ciphertext as hex
  const packed = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return Array.from(packed).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function decryptMnemonic(encrypted: string, password: string): Promise<string> {
  const packed = new Uint8Array(encrypted.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const ciphertext = packed.slice(28);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * WalletManager provides a high-level interface for wallet operations.
 */
export class WalletManager {
  private sphere: Sphere | null = null;
  private providers: BrowserProviders | null = null;
  private password: string | null = null;

  /**
   * Get the current wallet state.
   */
  async getState(): Promise<WalletState> {
    const result = await chrome.storage.local.get([ENCRYPTED_MNEMONIC_KEY]);

    return {
      hasWallet: !!result[ENCRYPTED_MNEMONIC_KEY],
      isUnlocked: this.sphere !== null,
      activeIdentityId: this.sphere?.identity?.l1Address ?? null,
    };
  }

  /**
   * Create a new wallet with the given password.
   * Returns identity info and the mnemonic for user backup.
   */
  async createWallet(password: string): Promise<{ identity: IdentityInfo; mnemonic: string }> {
    const mnemonic = Sphere.generateMnemonic();

    // Encrypt mnemonic and store
    const encrypted = await encryptMnemonic(mnemonic, password);
    await chrome.storage.local.set({ [ENCRYPTED_MNEMONIC_KEY]: encrypted });

    // Create sphere instance
    this.sphere = await this.createSphereFromMnemonic(mnemonic);
    this.password = password;

    const identity = this.getActiveIdentity();

    return { identity, mnemonic };
  }

  /**
   * Import wallet from mnemonic.
   */
  async importWallet(mnemonic: string, password: string): Promise<IdentityInfo> {
    if (!Sphere.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    // Encrypt mnemonic and store
    const encrypted = await encryptMnemonic(mnemonic, password);
    await chrome.storage.local.set({ [ENCRYPTED_MNEMONIC_KEY]: encrypted });

    // Create sphere instance
    this.sphere = await this.createSphereFromMnemonic(mnemonic);
    this.password = password;

    return this.getActiveIdentity();
  }

  /**
   * Unlock the wallet with password.
   */
  async unlock(password: string): Promise<IdentityInfo> {
    const result = await chrome.storage.local.get([ENCRYPTED_MNEMONIC_KEY]);

    if (!result[ENCRYPTED_MNEMONIC_KEY]) {
      throw new Error('No wallet found');
    }

    // Decrypt mnemonic (throws on wrong password)
    const mnemonic = await decryptMnemonic(result[ENCRYPTED_MNEMONIC_KEY], password);

    // Create sphere instance
    this.sphere = await this.createSphereFromMnemonic(mnemonic);
    this.password = password;

    // Set up incoming transfer listener
    this.setupTransferListener();

    // Log identity + payment state for debugging
    const identity = this.sphere.identity;
    console.log('[WalletManager] Wallet unlocked. Identity address:', identity?.l1Address);
    console.log('[WalletManager] Identity directAddress:', identity?.directAddress);
    try {
      const transport = (this.sphere as any).getTransport?.() ?? (this.sphere as any)._transport;
      if (transport?.getNostrPubkey) {
        console.log('[WalletManager] Transport Nostr pubkey:', transport.getNostrPubkey());
      }
      console.log('[WalletManager] Transport connected:', transport?.isConnected?.());
    } catch (e) {
      console.log('[WalletManager] Could not read transport info:', e);
    }
    // Check if nametag token is loaded (required for receiving PROXY transfers)
    try {
      const hasNametag = (this.sphere as any)._payments?.hasNametag?.() ?? false;
      const nametagData = (this.sphere as any)._payments?.getNametag?.();
      console.log('[WalletManager] Nametag loaded:', hasNametag, nametagData ? `name=${nametagData.name}` : '(none)');
      if (!hasNametag) {
        console.warn('[WalletManager] WARNING: No nametag token loaded — PROXY transfers will be rejected');
      }
    } catch (e) {
      console.log('[WalletManager] Could not check nametag state:', e);
    }

    // Verify nametag binding points to our current transport pubkey
    this.verifyNametagBinding().catch(() => {});

    return this.getActiveIdentity();
  }

  /**
   * Reset the wallet - clear all data and start fresh.
   */
  async resetWallet(): Promise<void> {
    // Destroy sphere instance if active
    if (this.sphere) {
      try {
        await this.sphere.destroy();
      } catch (err) {
        console.error('[WalletManager] Error destroying sphere during reset:', err);
      }
    }
    this.sphere = null;
    this.password = null;
    // Clear extension-specific data from chrome storage
    await chrome.storage.local.remove([
      ENCRYPTED_MNEMONIC_KEY,
      'nametag',
    ]);

    // Clear SDK data from IndexedDB (like sphere web app's deleteWallet)
    if (this.providers) {
      try {
        await Promise.allSettled([
          this.providers.storage.disconnect(),
          this.providers.tokenStorage.disconnect(),
        ]);
        const clearDone = Sphere.clear({
          storage: this.providers.storage,
          tokenStorage: this.providers.tokenStorage,
        });
        await Promise.race([clearDone, new Promise(r => setTimeout(r, 5000))]);
      } catch (e) {
        console.warn('[WalletManager] Sphere.clear() failed:', e);
      }
      this.providers = null;
    }

    // Safety net: delete all IndexedDB databases
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (e) {
      console.warn('[WalletManager] Could not clear IndexedDB:', e);
    }

    // Clear any legacy chrome.storage SDK keys (from old installs)
    try {
      const all = await chrome.storage.local.get(null);
      const sdkKeys = Object.keys(all).filter((k) => k.startsWith('sphere_sdk2_'));
      if (sdkKeys.length > 0) {
        await chrome.storage.local.remove(sdkKeys);
      }
    } catch { /* ignore */ }

    console.log('[WalletManager] Wallet reset complete');
  }

  /**
   * Lock the wallet (clear from memory).
   */
  async lock(): Promise<void> {
    if (this.sphere) {
      try {
        await this.sphere.destroy();
      } catch (err) {
        console.error('[WalletManager] Error destroying sphere:', err);
      }
    }
    this.sphere = null;
    this.providers = null;
    this.password = null;
  }

  // ============ Aggregator Config (no-op, SDK handles via createBrowserProviders) ============

  async getAggregatorConfig(): Promise<{ gatewayUrl: string; apiKey?: string }> {
    const result = await chrome.storage.local.get(['aggregatorConfig']);
    return result.aggregatorConfig || { gatewayUrl: '' };
  }

  async setAggregatorConfig(config: { gatewayUrl: string; apiKey?: string }): Promise<void> {
    await chrome.storage.local.set({ aggregatorConfig: config });
  }

  // ============ State Checks ============

  isUnlocked(): boolean {
    return this.sphere !== null;
  }

  private getSphere(): Sphere {
    if (!this.sphere) {
      throw new Error('Wallet is locked');
    }
    return this.sphere;
  }

  // ============ Identity / Address ============

  getActiveIdentity(): IdentityInfo {
    const sphere = this.getSphere();
    const identity = sphere.identity;
    if (!identity) {
      throw new Error('No active identity');
    }

    return {
      id: identity.l1Address,
      label: identity.nametag ? `@${identity.nametag}` : 'Default',
      publicKey: identity.chainPubkey,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * List identities - with HD wallets we return the active address.
   */
  listIdentities(): IdentityInfo[] {
    return [this.getActiveIdentity()];
  }

  // ============ Balance Methods ============

  getBalances(): TokenBalance[] {
    const sphere = this.getSphere();
    const balances: TokenBalance[] = [];

    try {
      // Aggregate confirmed and pending tokens separately by coinId
      const byCoin = new Map<string, { symbol: string; confirmed: bigint; pending: bigint; decimals: number }>();

      const allTokens = sphere.payments.getTokens();
      for (const tok of allTokens) {
        if (tok.status !== 'confirmed' && tok.status !== 'submitted') continue;
        const existing = byCoin.get(tok.coinId);
        const amount = BigInt(tok.amount);
        if (existing) {
          if (tok.status === 'confirmed') existing.confirmed += amount;
          else existing.pending += amount;
        } else {
          byCoin.set(tok.coinId, {
            symbol: COIN_SYMBOLS[tok.coinId] || tok.symbol || 'TOKEN',
            confirmed: tok.status === 'confirmed' ? amount : 0n,
            pending: tok.status === 'submitted' ? amount : 0n,
            decimals: COIN_DECIMALS[tok.coinId] ?? tok.decimals ?? DEFAULT_DECIMALS,
          });
        }
      }

      if (byCoin.size > 0) {
        for (const [coinId, info] of byCoin) {
          const formatted = formatSmallestUnits(info.confirmed.toString(), info.decimals);
          console.log('[WalletManager] Formatted:', coinId.slice(0, 8), formatted, 'pending:', info.pending.toString(), 'decimals:', info.decimals);
          if (formatted === '0' && info.pending === 0n && !COIN_SYMBOLS[coinId]) continue;
          const balance: TokenBalance = { coinId, symbol: info.symbol, amount: formatted };
          if (info.pending > 0n) {
            balance.pendingAmount = formatSmallestUnits(info.pending.toString(), info.decimals);
          }
          balances.push(balance);
        }
      } else {
        balances.push({ coinId: ALPHA_COIN_ID, symbol: 'UCT', amount: '0' });
      }
    } catch (error) {
      console.error('[WalletManager] Error getting balances:', error);
      balances.push({ coinId: ALPHA_COIN_ID, symbol: 'UCT', amount: '0' });
    }

    return balances;
  }

  /**
   * Get assets list (v0.5.3 API or fallback).
   */
  async getAssets(): Promise<any[]> {
    const sphere = this.getSphere();
    try {
      // Try v0.5.3 API first
      if (typeof sphere.payments.getAssets === 'function') {
        return await sphere.payments.getAssets();
      }
      // Fallback: aggregate from tokens
      return this.getBalances().map(b => ({
        coinId: b.coinId,
        symbol: b.symbol,
        totalAmount: b.amount,
        confirmedAmount: b.amount,
        unconfirmedAmount: b.pendingAmount || '0',
        decimals: COIN_DECIMALS[b.coinId] ?? DEFAULT_DECIMALS,
      }));
    } catch (error) {
      console.error('[WalletManager] Error getting assets:', error);
      return [];
    }
  }

  /**
   * Get individual tokens list.
   */
  getTokenList(): any[] {
    const sphere = this.getSphere();
    try {
      return sphere.payments.getTokens();
    } catch (error) {
      console.error('[WalletManager] Error getting tokens:', error);
      return [];
    }
  }

  /**
   * Get transaction history.
   */
  getTransactionHistory(): any[] {
    const sphere = this.getSphere();
    try {
      if (typeof sphere.payments.getHistory === 'function') {
        return sphere.payments.getHistory();
      }
      return [];
    } catch (error) {
      console.error('[WalletManager] Error getting history:', error);
      return [];
    }
  }

  /**
   * Get full identity info for the popup.
   */
  getFullIdentity(): any | null {
    const sphere = this.getSphere();
    const identity = sphere.identity;
    if (!identity) return null;
    return {
      chainPubkey: identity.chainPubkey,
      l1Address: identity.l1Address,
      directAddress: identity.directAddress,
      nametag: identity.nametag,
    };
  }

  getBalance(coinId: string): bigint {
    const sphere = this.getSphere();
    try {
      const tokens = sphere.payments.getTokens({ coinId, status: 'confirmed' });
      let total = 0n;
      for (const tok of tokens) {
        total += BigInt(tok.amount);
      }
      return total;
    } catch {
      return 0n;
    }
  }

  canAfford(coinId: string, amount: bigint): boolean {
    return this.getBalance(coinId) >= amount;
  }

  // ============ Token Health ============

  async checkTokenHealth(): Promise<TokenHealthResult> {
    const sphere = this.getSphere();
    const allTokens = sphere.payments.getTokens();
    const oracle = (sphere as any).getOracle?.() ?? (sphere as any)._oracle;
    const validTokens: typeof allTokens = [];
    const invalidTokens: { token: typeof allTokens[0]; reason: string }[] = [];

    // Get wallet's signing public key for ownership check via public SDK API
    let walletPubkey: Uint8Array | null = null;
    try {
      walletPubkey = await sphere.payments.getSigningPublicKey();
    } catch (e) {
      console.warn('[WalletManager] Could not get signing pubkey:', e);
    }

    for (const token of allTokens) {
      try {
        const tokenData = token.sdkData ? JSON.parse(token.sdkData) : null;
        if (!tokenData) {
          invalidTokens.push({ token, reason: 'No token data' });
          continue;
        }

        // Chain validity check
        const result = await oracle.validateToken(tokenData);
        if (!result.valid || result.spent) {
          invalidTokens.push({ token, reason: result.spent ? 'Token already spent' : 'Chain verification failed' });
          continue;
        }

        // Ownership check — does the wallet's key match the token's state predicate?
        if (walletPubkey) {
          const sdkToken = await SdkToken.fromJSON(tokenData);
          const predicate = await PredicateEngineService.createPredicate(sdkToken.state.predicate);
          const isOwner = await predicate.isOwner(walletPubkey);
          const pubkeyHex = Array.from(walletPubkey).map(b => b.toString(16).padStart(2, '0')).join('');
          console.log('[WalletManager] Ownership check:', token.id.slice(0, 8), 'isOwner:', isOwner, 'pubkey:', pubkeyHex.slice(0, 16) + '...');
          if (!isOwner) {
            invalidTokens.push({ token, reason: 'Ownership mismatch — wallet key does not match token predicate' });
            continue;
          }
        }

        validTokens.push(token);
      } catch (error) {
        console.warn('[WalletManager] Token validation failed:', token.id, error);
        invalidTokens.push({ token, reason: 'Validation error' });
      }
    }

    const invalidInfos: TokenHealthInfo[] = invalidTokens.map(({ token: tok, reason }) => ({
      id: tok.id,
      coinId: tok.coinId,
      symbol: COIN_SYMBOLS[tok.coinId] || tok.symbol || 'TOKEN',
      amount: tok.amount,
      status: tok.status,
      isValid: false,
      reason,
    }));

    return {
      total: allTokens.length,
      valid: validTokens.length,
      invalid: invalidInfos,
    };
  }

  async purgeInvalidTokens(): Promise<{ purged: number }> {
    const { invalid } = await this.checkTokenHealth();
    for (const tok of invalid) {
      await this.getSphere().payments.removeToken(tok.id);
    }
    return { purged: invalid.length };
  }

  // ============ Address Methods ============

  async getAddress(): Promise<string> {
    const sphere = this.getSphere();
    return sphere.identity?.l1Address ?? '';
  }

  // ============ Token Operations ============

  /**
   * Send tokens to a recipient.
   * Supports sending to public key/address or @nametag.
   */
  async sendAmount(
    coinId: string,
    amount: string,
    recipient: string
  ): Promise<SendTokensResult> {
    const sphere = this.getSphere();

    const result = await sphere.payments.send({
      coinId,
      amount,
      recipient,
    });

    return {
      transactionId: result.id ?? `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      recipientPayload: '', // SDK handles delivery via transport
      sent: amount,
      tokensUsed: result.tokens?.length ?? 1,
      splitPerformed: false,
    };
  }

  // ============ NOSTR Key Operations ============

  getNostrPublicKey(): { hex: string; npub: string } {
    const sphere = this.getSphere();
    const keyPair = deriveNostrKeyPair(sphere);

    return {
      hex: keyPair.publicKeyHex,
      npub: keyPair.npub,
    };
  }

  signNostrEventHash(eventHash: string): string {
    const sphere = this.getSphere();
    const keyPair = deriveNostrKeyPair(sphere);
    const hashBytes = hexToBytes(eventHash);
    return signNostrEvent(keyPair.privateKey, hashBytes);
  }

  nip44Encrypt(recipientPubkeyHex: string, plaintext: string): string {
    const sphere = this.getSphere();
    const keyPair = deriveNostrKeyPair(sphere);
    const privKeyHex = bytesToHex(keyPair.privateKey);
    return NIP44.encryptHex(plaintext, privKeyHex, recipientPubkeyHex);
  }

  nip44Decrypt(senderPubkeyHex: string, ciphertext: string): string {
    const sphere = this.getSphere();
    const keyPair = deriveNostrKeyPair(sphere);
    const privKeyHex = bytesToHex(keyPair.privateKey);
    return NIP44.decryptHex(ciphertext, privKeyHex, senderPubkeyHex);
  }

  signMessageWithIdentity(message: string): string {
    const sphere = this.getSphere();
    const keyPair = deriveNostrKeyPair(sphere);
    return signMessage(keyPair.privateKey, message);
  }

  // ============ Export ============

  exportWallet(): string {
    const sphere = this.getSphere();
    const walletJson = sphere.exportToJSON({
      password: this.password ?? undefined,
      includeMnemonic: true,
    });
    return JSON.stringify(walletJson, null, 2);
  }

  /**
   * Get the mnemonic for backup display.
   */
  getMnemonic(): string | null {
    const sphere = this.getSphere();
    return sphere.getMnemonic();
  }

  // ============ Nametag Operations ============

  async resolveNametag(nametag: string): Promise<NametagResolution | null> {
    const sphere = this.getSphere();
    const cleanTag = nametag.replace('@unicity', '').replace('@', '').trim().toLowerCase();

    try {
      const transport = sphere.getTransport();
      if (!transport.resolveNametag) {
        console.warn('[WalletManager] Transport does not support nametag resolution');
        return null;
      }

      const pubkey = await transport.resolveNametag(cleanTag);
      if (!pubkey) {
        return null;
      }

      return {
        nametag: cleanTag,
        pubkey,
        proxyAddress: pubkey, // The SDK transport handles routing
      };
    } catch (error) {
      console.error('[WalletManager] Nametag resolution error:', error);
      return null;
    }
  }

  async isNametagAvailable(nametag: string): Promise<boolean> {
    const cleanTag = nametag.replace('@', '').trim().toLowerCase();

    // If wallet is unlocked, use the SDK's built-in check
    if (this.sphere) {
      // If this wallet already owns this nametag (NOSTR binding done, mint may be pending),
      // treat it as "available" so the user can retry the mint.
      if (this.sphere.identity?.nametag === cleanTag) {
        console.log(`[WalletManager] isNametagAvailable: @${cleanTag} is owned by this wallet, treating as available`);
        return true;
      }

      try {
        const result = await this.sphere.isNametagAvailable(cleanTag);
        console.log('[WalletManager] isNametagAvailable result for', cleanTag, ':', result);
        return result;
      } catch (error) {
        console.error('[WalletManager] Nametag availability check error:', error);
        return false;
      }
    }

    // Wallet is locked / not created yet — use standalone transport for read-only check
    // (like sphere web app does with dummy identity)
    return this.isNametagAvailableStandalone(cleanTag);
  }

  /**
   * Check nametag availability via a temporary transport (no wallet required).
   * Mirrors sphere web app's resolveNametag() approach with dummy identity.
   */
  private async isNametagAvailableStandalone(cleanTag: string): Promise<boolean> {
    let tempProviders: BrowserProviders | null = null;
    try {
      tempProviders = createBrowserProviders({ network: 'testnet' });
      const transport = tempProviders.transport;
      await transport.connect();
      // Set dummy identity for read-only queries (like sphere SphereProvider.tsx)
      await transport.setIdentity({
        privateKey: '0000000000000000000000000000000000000000000000000000000000000001',
        chainPubkey: '000000000000000000000000000000000000000000000000000000000000000000',
        l1Address: '',
      });

      const resolved = await transport.resolveNametag?.(cleanTag);
      const available = !resolved;
      console.log(`[WalletManager] Standalone nametag check for @${cleanTag}: ${available ? 'available' : 'taken'}`);
      return available;
    } catch (error) {
      console.error('[WalletManager] Standalone nametag check error:', error);
      return false;
    } finally {
      try { await tempProviders?.transport?.disconnect?.(); } catch { /* ignore */ }
    }
  }

  async registerNametag(nametag: string): Promise<NametagInfo> {
    const sphere = this.getSphere();
    const cleanTag = nametag.replace('@', '').trim().toLowerCase();

    // If identity already has a nametag (e.g. NOSTR binding succeeded but mint
    // failed on a previous attempt), skip re-registration and just retry the mint.
    const existingNametag = sphere.identity?.nametag;
    if (existingNametag) {
      console.log(`[WalletManager] Identity already has nametag @${existingNametag}, skipping NOSTR binding`);
      if (existingNametag !== cleanTag) {
        throw new Error(`Cannot register @${cleanTag}: address already bound to @${existingNametag}`);
      }
    } else {
      // Register NOSTR binding
      await sphere.registerNametag(cleanTag);
    }

    const nametagInfo: NametagInfo = {
      nametag: cleanTag,
      proxyAddress: sphere.identity?.directAddress ?? '',
      tokenId: '',
      status: 'active',
    };

    // Save to chrome storage BEFORE minting — so nametag is persisted even if mint fails.
    // On next unlock the SDK will re-read the binding from the relay.
    await this.saveNametag({
      name: cleanTag,
      tokenJson: '{}',
      proxyAddress: nametagInfo.proxyAddress,
      timestamp: Date.now(),
    });

    // Mint on-chain nametag token (required for receiving PROXY transfers).
    // Failure here is non-fatal — the nametag is already bound on Nostr
    // and saved locally. The mint can be retried later.
    try {
      if (!(sphere as any)._payments?.hasNametag?.()) {
        console.log('[WalletManager] Minting nametag token on-chain...');
        const mintResult = await (sphere as any).mintNametag(cleanTag);
        if (!mintResult.success) {
          console.warn('[WalletManager] Nametag mint failed (non-fatal):', JSON.stringify(mintResult));
        } else {
          console.log('[WalletManager] Nametag minted on-chain:', cleanTag);
        }
      } else {
        console.log('[WalletManager] Nametag token already present, skipping mint');
      }
    } catch (mintErr) {
      console.warn('[WalletManager] Nametag mint error (non-fatal):', mintErr);
    }

    return nametagInfo;
  }

  // ============ Nametag Storage ============

  async getStoredNametag(): Promise<StoredNametag | null> {
    const result = await chrome.storage.local.get(['nametag']);
    return result.nametag || null;
  }

  async saveNametag(nametag: StoredNametag): Promise<void> {
    await chrome.storage.local.set({ nametag });
  }

  async deleteNametag(): Promise<void> {
    await chrome.storage.local.remove(['nametag']);
  }

  async getMyNametag(): Promise<NametagInfo | null> {
    const stored = await this.getStoredNametag();
    if (!stored) return null;

    return {
      nametag: stored.name,
      proxyAddress: stored.proxyAddress,
      tokenId: '',
      status: 'active',
    };
  }

  // ============ Nametag Binding Verification ============

  /**
   * Check that our nametag on the relay resolves to our current transport pubkey.
   * If there's a mismatch (e.g. SDK upgrade changed key derivation), transfers
   * sent to @nametag will target the old pubkey and we'll never see them.
   */
  private async verifyNametagBinding(): Promise<void> {
    const sphere = this.sphere;
    if (!sphere) return;

    const stored = await this.getStoredNametag();
    if (!stored?.name) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transport = sphere.getTransport() as any;
      const myTransportPubkey: string = transport.getNostrPubkey();

      const resolved: string | null = await transport.resolveNametag(stored.name);
      if (!resolved) {
        console.warn(`[WalletManager] Nametag @${stored.name} not found on relay`);
        return;
      }

      if (resolved === myTransportPubkey) {
        console.log(`[WalletManager] Nametag @${stored.name} binding OK — matches transport pubkey`);
        // Binding is fine, but still check if the on-chain token needs re-minting
        await this.ensureNametagTokenMigrated(stored.name);
        return;
      }

      console.error(`[WalletManager] NAMETAG BINDING MISMATCH!`);
      console.error(`[WalletManager]   Relay binding pubkey: ${resolved}`);
      console.error(`[WalletManager]   Our transport pubkey: ${myTransportPubkey}`);
      console.error(`[WalletManager]   SDK upgrade changed identity key derivation — full re-registration needed`);

      // Step 1: Re-register Nostr binding with new transport pubkey
      console.log(`[WalletManager] Step 1: Re-registering Nostr binding for @${stored.name}...`);
      const directAddress = sphere.identity?.directAddress ?? '';
      const origResolve = transport.resolveNametag.bind(transport);
      transport.resolveNametag = async () => null;
      try {
        const result = await transport.registerNametag(stored.name, '', directAddress);
        if (result) {
          console.log(`[WalletManager] Nostr binding updated successfully`);
        } else {
          console.error(`[WalletManager] Failed to update Nostr binding`);
          return;
        }
      } finally {
        transport.resolveNametag = origResolve;
      }

      // Step 2: Clear old nametag token and re-mint with new identity
      // The old token was minted with old identity's signing predicates — PROXY
      // finalization will fail with "Recipient verification failed" until re-minted.
      console.log(`[WalletManager] Step 2: Re-minting nametag token with new identity...`);
      const payments = (sphere as any)._payments;
      if (payments?.clearNametag) {
        await payments.clearNametag();
        console.log(`[WalletManager] Old nametag token cleared`);
      }
      const mintResult = await sphere.mintNametag(stored.name);
      if (mintResult.success) {
        console.log(`[WalletManager] Nametag token re-minted successfully with new identity`);
      } else {
        console.error(`[WalletManager] Nametag re-mint failed:`, mintResult.error);
        console.error(`[WalletManager] PROXY transfers will fail until nametag is re-minted`);
      }
    } catch (e) {
      console.warn('[WalletManager] Nametag binding verification failed:', e);
    }
  }

  /**
   * One-time migration: re-mint nametag token if it was created by old SDK identity.
   * The old token has predicates from the old key derivation, so PROXY finalization
   * fails with "Recipient verification failed".
   */
  private async ensureNametagTokenMigrated(nametagName: string): Promise<void> {
    const FLAG_KEY = 'nametag_token_migrated_v1';
    const flagResult = await chrome.storage.local.get(FLAG_KEY);
    if (flagResult[FLAG_KEY]) return; // Already migrated

    const sphere = this.sphere;
    if (!sphere) return;

    console.log(`[WalletManager] Nametag token migration: clearing old token and re-minting @${nametagName}...`);

    // Clear old nametag token (minted with old identity's predicates)
    const payments = (sphere as any)._payments;
    if (payments?.clearNametag) {
      await payments.clearNametag();
      console.log(`[WalletManager] Old nametag token cleared from payments module`);
    }

    // Re-mint with current identity
    const mintResult = await sphere.mintNametag(nametagName);
    if (mintResult.success) {
      console.log(`[WalletManager] Nametag token re-minted successfully`);
      await chrome.storage.local.set({ [FLAG_KEY]: Date.now() });
    } else {
      console.error(`[WalletManager] Nametag token re-mint failed:`, mintResult.error);
      console.error(`[WalletManager] PROXY transfers will continue to fail until re-minted`);
    }
  }

  // ============ Sphere Instance Creation ============

  private async createSphereFromMnemonic(mnemonic: string): Promise<Sphere> {
    // Create providers exactly like sphere web app — SDK handles all URLs/relays
    const browserProviders = createBrowserProviders({ network: 'testnet' });
    this.providers = browserProviders;

    // Use init() which auto-loads existing or creates new
    const { sphere } = await Sphere.init({
      ...browserProviders,
      mnemonic,
      l1: {},
      discoverAddresses: false,
    });

    // Migrate data from old address format if needed (SDK 0.1.2 → 0.1.9 changed address encoding)
    const tokens = sphere.payments.getTokens({ status: 'confirmed' });
    if (tokens.length === 0) {
      const newAddress = sphere.identity?.l1Address;
      const directAddress = sphere.identity?.directAddress;
      if (newAddress && directAddress) {
        const chrMigrated = await migrateOldChromeStorageData(newAddress);
        const idbMigrated = await migrateOldIndexedDBData(directAddress);
        if (chrMigrated || idbMigrated) {
          console.log('[WalletManager] Migrated old data, destroying first sphere and reloading...');
          try { await sphere.destroy(); } catch { /* ignore */ }
          // Re-create providers (transport was disconnected by destroy)
          const browserProviders2 = createBrowserProviders({ network: 'testnet' });
          this.providers = browserProviders2;
          const { sphere: reloaded } = await Sphere.init({
            ...browserProviders2,
            mnemonic,
            l1: {},
            discoverAddresses: false,
          });
          return reloaded;
        }
      }
    }

    return sphere;
  }

  // ============ Token Finalization ============

  /**
   * Finalize pending (submitted) V5 tokens by polling the aggregator.
   * Calls sphere.payments.receive({ finalize: true }) which resolves
   * unconfirmed tokens through the RECEIVED → CONFIRMED pipeline.
   */
  async finalizeTokens(): Promise<{ resolved: number; pending: number; failed: number }> {
    const sphere = this.getSphere();
    try {
      console.log('[WalletManager] Starting token finalization...');
      const result = await sphere.payments.receive({
        finalize: true,
        timeout: 60_000,
        pollInterval: 2_000,
        onProgress: (res: { resolved: number; stillPending: number; failed: number }) => {
          console.log(`[WalletManager] Finalization progress: ${res.resolved} resolved, ${res.stillPending} pending, ${res.failed} failed`);
        },
      });
      const fin = result.finalization ?? { resolved: 0, stillPending: 0, failed: 0 };
      console.log(`[WalletManager] Finalization complete: ${fin.resolved} resolved, ${fin.stillPending} pending, ${fin.failed} failed`);
      return { resolved: fin.resolved, pending: fin.stillPending, failed: fin.failed };
    } catch (error) {
      console.error('[WalletManager] Finalization error:', error);
      return { resolved: 0, pending: 0, failed: 0 };
    }
  }

  /**
   * Push current balances to any open popup/content script.
   * Silently ignores errors (popup may not be open).
   */
  private broadcastBalances(): void {
    try {
      const balances = this.getBalances();
      chrome.runtime.sendMessage({ type: 'BALANCES_UPDATED', balances }).catch(() => {});
    } catch {
      // Wallet may not be initialized yet
    }
  }

  // ============ Transfer Listener ============

  private setupTransferListener(): void {
    if (!this.sphere) return;

    this.sphere.on('transfer:incoming', (data: unknown) => {
      console.log('[WalletManager] Incoming transfer received:', JSON.stringify(data, null, 2));
      // Push pending balance to popup immediately
      this.broadcastBalances();
      // Trigger finalization for the newly received V5 token
      this.finalizeTokens().then(() => {
        // Push confirmed balance once finalization completes
        this.broadcastBalances();
      }).catch((err) => {
        console.error('[WalletManager] Background finalization failed:', err);
      });
    });

    // Also listen for connection changes to detect transport drops
    this.sphere.on('connection:changed', (data: unknown) => {
      console.log('[WalletManager] Connection changed:', data);
    });

    console.log('[WalletManager] Transfer listener configured');
  }
}

// ============ Helpers ============

/**
 * Convert a smallest-unit amount string to a human-readable decimal string.
 */
function formatSmallestUnits(amount: string, decimals: number): string {
  if (amount === '0' || !amount) return '0';
  if (decimals === 0) return amount;

  const padded = amount.padStart(decimals + 1, '0');
  const integerPart = padded.slice(0, -decimals) || '0';
  const fractionalPart = padded.slice(-decimals).replace(/0+$/, '');

  if (fractionalPart) {
    return `${integerPart}.${fractionalPart}`;
  }
  return integerPart;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ============ Storage Migration (SDK 0.1.2 → 0.1.9) ============
// SDK 0.1.2 used hex address (alpha184e7e30...), SDK 0.1.9 uses bech32 (alpha1qm0k2a...).
// Data lives in both chrome.storage.local AND IndexedDB, keyed by the old address.

const STORAGE_PREFIX = 'sphere_sdk2_';
const TOKEN_DB_PREFIX = 'sphere-token-storage';
const TOKEN_STORES = ['tokens', 'meta'];

/** Match SDK's getAddressId() logic for the new DB name suffix */
function getAddressId(directAddress: string): string {
  let hash = directAddress;
  if (hash.startsWith('DIRECT://')) hash = hash.slice(9);
  else if (hash.startsWith('DIRECT:')) hash = hash.slice(7);
  return `DIRECT_${hash.slice(0, 6).toLowerCase()}_${hash.slice(-6).toLowerCase()}`;
}

// --- Chrome Storage migration ---

async function migrateOldChromeStorageData(newAddress: string): Promise<boolean> {
  try {
    const allData = await chrome.storage.local.get(null);
    const allKeys = Object.keys(allData);
    const newPrefix = `${STORAGE_PREFIX}${newAddress}_`;

    // Already migrated?
    if (allKeys.some(k => k.startsWith(newPrefix) && k.endsWith('_sphere_tokens'))) return false;

    const oldTokenKey = allKeys.find(k =>
      k.startsWith(STORAGE_PREFIX) && k.endsWith('_sphere_tokens') && !k.startsWith(newPrefix)
    );
    if (!oldTokenKey) return false;

    const oldPrefix = oldTokenKey.replace(/sphere_tokens$/, '');
    console.log(`[WalletManager] Chrome migration: ${oldPrefix} → ${newPrefix}`);

    const toWrite: Record<string, unknown> = {};
    let count = 0;
    for (const key of allKeys) {
      if (key.startsWith(oldPrefix)) {
        const suffix = key.slice(oldPrefix.length);
        toWrite[`${newPrefix}${suffix}`] = allData[key];
        count++;
        console.log(`[WalletManager]   chrome: ${suffix}`);
      }
    }
    if (count === 0) return false;

    console.log(`[WalletManager] Chrome migration: ${count} keys`);
    await chrome.storage.local.set(toWrite);
    return true;
  } catch (err) {
    console.warn('[WalletManager] Chrome storage migration failed:', err);
    return false;
  }
}

// --- IndexedDB migration ---

function openIDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      for (const s of TOKEN_STORES) {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReadAll(db: IDBDatabase, store: string): Promise<{ key: IDBValidKey; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(store)) { resolve([]); return; }
    const tx = db.transaction(store, 'readonly');
    const s = tx.objectStore(store);
    const out: { key: IDBValidKey; value: unknown }[] = [];
    const cur = s.openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } else resolve(out); };
    cur.onerror = () => reject(cur.error);
  });
}

function idbWriteAll(db: IDBDatabase, store: string, records: { key: IDBValidKey; value: unknown }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (records.length === 0 || !db.objectStoreNames.contains(store)) { resolve(); return; }
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    // Use put(value) for stores with in-line keys (keyPath), put(value, key) for out-of-line
    const hasKeyPath = s.keyPath !== null;
    for (const r of records) {
      if (hasKeyPath) s.put(r.value);
      else s.put(r.value, r.key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateOldIndexedDBData(directAddress: string): Promise<boolean> {
  try {
    const newAddressId = getAddressId(directAddress);
    const newDbName = `${TOKEN_DB_PREFIX}-${newAddressId}`;

    // Find old per-address DB by listing all databases
    if (typeof indexedDB.databases !== 'function') return false;
    const dbs = await indexedDB.databases();
    const oldDb = dbs.find(d =>
      d.name && d.name.startsWith(TOKEN_DB_PREFIX) && d.name !== newDbName && d.name !== TOKEN_DB_PREFIX
    );
    if (!oldDb?.name) {
      console.log('[WalletManager] No old per-address IndexedDB found');
      return false;
    }

    console.log(`[WalletManager] IDB migration: ${oldDb.name} → ${newDbName}`);

    const src = await openIDB(oldDb.name);
    let total = 0;
    const allData: Record<string, { key: IDBValidKey; value: unknown }[]> = {};
    for (const store of TOKEN_STORES) {
      const records = await idbReadAll(src, store);
      allData[store] = records;
      total += records.length;
      console.log(`[WalletManager]   idb ${store}: ${records.length} records`);
    }
    src.close();

    if (total === 0) return false;

    const dst = await openIDB(newDbName);
    for (const store of TOKEN_STORES) {
      await idbWriteAll(dst, store, allData[store]);
    }
    dst.close();

    console.log(`[WalletManager] IDB migration: ${total} records copied`);
    return true;
  } catch (err) {
    console.warn('[WalletManager] IndexedDB migration failed:', err);
    return false;
  }
}

// Singleton instance
export const walletManager = new WalletManager();

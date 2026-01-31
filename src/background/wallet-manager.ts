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
import {
  createNostrTransportProvider,
  createUnicityAggregatorProvider,
  createIndexedDBTokenStorageProvider,
} from '@unicitylabs/sphere-sdk/impl/browser';
import { createChromeStorageProvider } from './providers';
import type {
  IdentityInfo,
  TokenBalance,
  WalletState,
  SendTokensResult,
  NametagResolution,
  StoredNametag,
  NametagInfo,
  AggregatorConfig,
} from '@/shared/types';
import { COIN_SYMBOLS, COIN_DECIMALS, DEFAULT_DECIMALS, ALPHA_COIN_ID, GATEWAY_URL, DEFAULT_NOSTR_RELAYS } from '@/shared/constants';
import { deriveNostrKeyPair, signNostrEvent, signMessage } from './nostr-keys';

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
  private password: string | null = null;
  private cachedAggregatorConfig: AggregatorConfig | null = null;

  /**
   * Get the current wallet state.
   */
  async getState(): Promise<WalletState> {
    const result = await chrome.storage.local.get([ENCRYPTED_MNEMONIC_KEY]);

    return {
      hasWallet: !!result[ENCRYPTED_MNEMONIC_KEY],
      isUnlocked: this.sphere !== null,
      activeIdentityId: this.sphere?.identity?.address ?? null,
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

    // Load aggregator config (API key, gateway URL)
    await this.loadAggregatorConfig();

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

    // Load aggregator config (API key, gateway URL)
    await this.loadAggregatorConfig();

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

    // Load aggregator config
    await this.loadAggregatorConfig();

    // Create sphere instance
    this.sphere = await this.createSphereFromMnemonic(mnemonic);
    this.password = password;

    // Set up incoming transfer listener
    this.setupTransferListener();

    // Log identity info for debugging token receiving
    const identity = this.sphere.identity;
    console.log('[WalletManager] Wallet unlocked. Identity address:', identity?.address);
    console.log('[WalletManager] Identity publicKey:', identity?.publicKey);
    try {
      const transport = (this.sphere as any).getTransport();
      if (transport?.getNostrPubkey) {
        console.log('[WalletManager] Transport NOSTR pubkey (sender must target this):', transport.getNostrPubkey());
      }
    } catch (e) {
      console.log('[WalletManager] Could not read transport pubkey:', e);
    }

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
    this.cachedAggregatorConfig = null;

    // Clear all wallet data from chrome storage
    await chrome.storage.local.remove([
      ENCRYPTED_MNEMONIC_KEY,
      'nametag',
    ]);

    // Clear SDK storage (keys prefixed with sphere_sdk2_)
    const all = await chrome.storage.local.get(null);
    const sdkKeys = Object.keys(all).filter((k) => k.startsWith('sphere_sdk2_'));
    if (sdkKeys.length > 0) {
      await chrome.storage.local.remove(sdkKeys);
    }

    // Clear IndexedDB token storage used by SDK
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
    this.password = null;
    this.cachedAggregatorConfig = null;
  }

  // ============ Aggregator Config ============

  private async loadAggregatorConfig(): Promise<void> {
    const result = await chrome.storage.local.get(['aggregatorConfig']);
    this.cachedAggregatorConfig = result.aggregatorConfig || null;
  }

  async getAggregatorConfig(): Promise<AggregatorConfig> {
    const result = await chrome.storage.local.get(['aggregatorConfig']);
    return result.aggregatorConfig || {
      gatewayUrl: GATEWAY_URL,
      apiKey: undefined,
    };
  }

  async setAggregatorConfig(config: AggregatorConfig): Promise<void> {
    await chrome.storage.local.set({ aggregatorConfig: config });
    this.cachedAggregatorConfig = config;
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
      id: identity.address,
      label: identity.nametag ? `@${identity.nametag}` : 'Default',
      publicKey: identity.publicKey,
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
      // Get all balances from the SDK
      const sdkBalances = sphere.payments.getBalance();

      if (sdkBalances.length > 0) {
        for (const bal of sdkBalances) {
          console.log('[WalletManager] SDK balance:', JSON.stringify(bal));
          const decimals = COIN_DECIMALS[bal.coinId] ?? bal.decimals ?? DEFAULT_DECIMALS;
          const formatted = formatSmallestUnits(bal.totalAmount, decimals);
          console.log('[WalletManager] Formatted:', bal.coinId.slice(0, 8), formatted, 'decimals:', decimals);
          // Skip zero-balance unknown tokens
          if (formatted === '0' && !COIN_SYMBOLS[bal.coinId]) continue;
          balances.push({
            coinId: bal.coinId,
            symbol: COIN_SYMBOLS[bal.coinId] || bal.symbol || 'TOKEN',
            amount: formatted,
          });
        }
      } else {
        balances.push({
          coinId: ALPHA_COIN_ID,
          symbol: 'UCT',
          amount: '0',
        });
      }
    } catch (error) {
      console.error('[WalletManager] Error getting balances:', error);
      balances.push({
        coinId: ALPHA_COIN_ID,
        symbol: 'UCT',
        amount: '0',
      });
    }

    return balances;
  }

  getBalance(coinId: string): bigint {
    const sphere = this.getSphere();
    try {
      const sdkBalances = sphere.payments.getBalance(coinId);
      if (sdkBalances.length > 0) {
        return BigInt(sdkBalances[0].totalAmount);
      }
      return 0n;
    } catch {
      return 0n;
    }
  }

  canAfford(coinId: string, amount: bigint): boolean {
    return this.getBalance(coinId) >= amount;
  }

  // ============ Address Methods ============

  async getAddress(): Promise<string> {
    const sphere = this.getSphere();
    return sphere.identity?.address ?? '';
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
    const sphere = this.getSphere();
    const cleanTag = nametag.replace('@', '').trim().toLowerCase();

    try {
      // Debug: check oracle state
      const oracle = (sphere as any).getOracle?.() ?? (sphere as any)._oracle;
      console.log('[WalletManager] Oracle trustBase:', !!oracle?.getTrustBase?.());
      console.log('[WalletManager] Oracle stClient:', !!oracle?.getStateTransitionClient?.());

      const result = await sphere.isNametagAvailable(cleanTag);
      console.log('[WalletManager] isNametagAvailable result for', cleanTag, ':', result);
      return result;
    } catch (error) {
      console.error('[WalletManager] Nametag availability check error:', error);
      return false;
    }
  }

  async registerNametag(nametag: string): Promise<NametagInfo> {
    const sphere = this.getSphere();
    const cleanTag = nametag.replace('@', '').trim().toLowerCase();

    // Register NOSTR binding
    await sphere.registerNametag(cleanTag);

    // Mint on-chain nametag token (required for receiving PROXY transfers)
    // Note: sphere.registerNametag already attempts mintNametag internally,
    // but we call it again explicitly in case the internal attempt failed silently
    if (!(sphere as any)._payments?.hasNametag?.()) {
      const mintResult = await (sphere as any).mintNametag(cleanTag);
      if (!mintResult.success) {
        console.error('[WalletManager] Nametag mint failed:', JSON.stringify(mintResult));
        throw new Error(`Nametag NOSTR binding succeeded but on-chain mint failed: ${JSON.stringify(mintResult.error)}`);
      }
      console.log('[WalletManager] Nametag minted on-chain:', cleanTag);
    } else {
      console.log('[WalletManager] Nametag token already present, skipping mint');
    }

    const nametagInfo: NametagInfo = {
      nametag: cleanTag,
      proxyAddress: sphere.identity?.predicateAddress ?? '',
      tokenId: '',
      status: 'active',
    };

    // Save to chrome storage for local lookup
    await this.saveNametag({
      name: cleanTag,
      tokenJson: '{}',
      proxyAddress: nametagInfo.proxyAddress,
      timestamp: Date.now(),
    });

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

  // ============ Sphere Instance Creation ============

  private async createSphereFromMnemonic(mnemonic: string): Promise<Sphere> {
    const config = this.cachedAggregatorConfig;
    const gatewayUrl = config?.gatewayUrl || GATEWAY_URL;

    const storage = createChromeStorageProvider({ prefix: 'sphere_sdk2_', debug: true });
    await storage.connect();

    const transport = createNostrTransportProvider({
      relays: DEFAULT_NOSTR_RELAYS,
      debug: true,
    });

    const oracle = createUnicityAggregatorProvider({
      url: gatewayUrl,
      apiKey: config?.apiKey,
      trustBaseUrl: 'https://raw.githubusercontent.com/unicitynetwork/unicity-ids/refs/heads/main/bft-trustbase.testnet.json',
      debug: true,
    });

    const tokenStorage = createIndexedDBTokenStorageProvider();

    // Use init() which auto-loads existing or creates new
    const { sphere } = await Sphere.init({
      mnemonic,
      storage,
      transport,
      oracle,
      tokenStorage,
    });

    return sphere;
  }

  // ============ Transfer Listener ============

  private setupTransferListener(): void {
    if (!this.sphere) return;

    this.sphere.on('transfer:incoming', (data: unknown) => {
      console.log('[WalletManager] Incoming transfer:', data);
      // Balance updates automatically via SDK
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

// Singleton instance
export const walletManager = new WalletManager();

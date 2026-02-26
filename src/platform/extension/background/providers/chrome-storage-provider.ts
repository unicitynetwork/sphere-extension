/**
 * Chrome Storage Provider
 * Implements StorageProvider using chrome.storage.local for service worker compatibility.
 * Service workers have no localStorage, so we use chrome.storage.local instead.
 */

import type { StorageProvider, ProviderStatus, FullIdentity, TrackedAddressEntry } from '@unicitylabs/sphere-sdk';

// =============================================================================
// Configuration
// =============================================================================

export interface ChromeStorageProviderConfig {
  /** Key prefix (default: 'sphere_sdk2_') */
  prefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Implementation
// =============================================================================

export class ChromeStorageProvider implements StorageProvider {
  readonly id = 'chromeStorage';
  readonly name = 'Chrome Storage';
  readonly type = 'local' as const;
  readonly description = 'Chrome extension storage for service worker persistence';

  private prefix: string;
  private debug: boolean;
  private address: string = 'default';
  private connected = false;

  constructor(config?: ChromeStorageProviderConfig) {
    this.prefix = config?.prefix ?? 'sphere_sdk2_';
    this.debug = config?.debug ?? false;
  }

  // ===========================================================================
  // BaseProvider Implementation
  // ===========================================================================

  async connect(): Promise<void> {
    if (this.connected) return;

    // Test chrome.storage availability
    const testKey = `${this.prefix}_test`;
    await chrome.storage.local.set({ [testKey]: 'test' });
    await chrome.storage.local.remove(testKey);

    this.connected = true;
    this.log('Connected to chrome.storage.local');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.log('Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): ProviderStatus {
    return this.connected ? 'connected' : 'disconnected';
  }

  // ===========================================================================
  // StorageProvider Implementation
  // ===========================================================================

  setIdentity(identity: FullIdentity): void {
    this.address = identity.l1Address;
    this.log('Identity set:', identity.l1Address);
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    const fullKey = this.getFullKey(key);
    const result = await chrome.storage.local.get(fullKey);
    return result[fullKey] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.ensureConnected();
    const fullKey = this.getFullKey(key);
    await chrome.storage.local.set({ [fullKey]: value });
  }

  async remove(key: string): Promise<void> {
    this.ensureConnected();
    const fullKey = this.getFullKey(key);
    await chrome.storage.local.remove(fullKey);
  }

  async has(key: string): Promise<boolean> {
    this.ensureConnected();
    const fullKey = this.getFullKey(key);
    const result = await chrome.storage.local.get(fullKey);
    return fullKey in result;
  }

  async keys(prefix?: string): Promise<string[]> {
    this.ensureConnected();
    const basePrefix = this.getFullKey('');
    const searchPrefix = prefix ? this.getFullKey(prefix) : basePrefix;

    const allData = await chrome.storage.local.get(null);
    const result: string[] = [];

    for (const key of Object.keys(allData)) {
      if (key.startsWith(searchPrefix)) {
        result.push(key.slice(basePrefix.length));
      }
    }

    return result;
  }

  async clear(prefix?: string): Promise<void> {
    this.ensureConnected();
    const keysToRemove = await this.keys(prefix);
    for (const key of keysToRemove) {
      await this.remove(key);
    }
  }

  async saveTrackedAddresses(entries: TrackedAddressEntry[]): Promise<void> {
    await this.set('tracked_addresses', JSON.stringify(entries));
  }

  async loadTrackedAddresses(): Promise<TrackedAddressEntry[]> {
    const data = await this.get('tracked_addresses');
    if (!data) return [];
    return JSON.parse(data) as TrackedAddressEntry[];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private getFullKey(key: string): string {
    return `${this.prefix}${this.address}_${key}`;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('ChromeStorageProvider not connected');
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[ChromeStorageProvider]', ...args);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createChromeStorageProvider(
  config?: ChromeStorageProviderConfig
): ChromeStorageProvider {
  return new ChromeStorageProvider(config);
}

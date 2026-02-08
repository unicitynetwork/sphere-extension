/**
 * Inject script - defines the window.sphere API.
 *
 * This script is injected into web pages and provides:
 * - window.sphere object with wallet methods
 * - Request/response matching with timeouts
 * - 'sphereReady' event dispatching
 */

import { generateRequestId, REQUEST_TIMEOUT } from '@/shared/messages';
import type {
  IdentityInfo,
  TokenBalance,
  NametagResolution,
  SphereResponse,
} from '@/shared/types';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Sphere Wallet API exposed to web pages.
 */
class SphereAPI {
  private pendingRequests: Map<string, PendingRequest> = new Map();

  constructor() {
    this.setupMessageHandling();
  }

  private setupMessageHandling(): void {
    window.addEventListener('message', (event) => {
      // Only accept messages from the same window
      if (event.source !== window) return;

      const data = event.data as SphereResponse | null;
      if (!data?.type?.startsWith('SPHERE_')) return;
      if (!data.type.endsWith('_RESPONSE') && !data.type.includes('_RESULT')) return;

      const { requestId } = data;
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);

        if ('success' in data && data.success === false) {
          pending.reject(new Error(data.error || 'Request failed'));
        } else {
          pending.resolve(data);
        }
      }
    });
  }

  private createRequest<T>(type: string, data: Record<string, unknown> = {}): Promise<T> {
    const requestId = generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeout });

      window.postMessage({
        type,
        requestId,
        ...data
      }, '*');
    });
  }

  /**
   * Check if the Sphere extension is installed.
   */
  isInstalled(): boolean {
    return true; // If this script is running, the extension is installed
  }

  /**
   * Request connection to the wallet.
   * Opens popup for user approval if not already connected.
   */
  async connect(): Promise<IdentityInfo> {
    const response = await this.createRequest<{ identity: IdentityInfo }>('SPHERE_CONNECT');
    return response.identity;
  }

  /**
   * Disconnect from the wallet.
   */
  async disconnect(): Promise<void> {
    await this.createRequest('SPHERE_DISCONNECT');
  }

  /**
   * Get the currently active identity.
   * Returns null if not connected.
   */
  async getActiveIdentity(): Promise<IdentityInfo | null> {
    const response = await this.createRequest<{ identity: IdentityInfo | null }>('SPHERE_GET_ACTIVE_IDENTITY');
    return response.identity;
  }

  /**
   * Get all token balances for the active identity.
   */
  async getBalances(): Promise<TokenBalance[]> {
    const response = await this.createRequest<{ balances: TokenBalance[] }>('SPHERE_GET_BALANCES');
    return response.balances;
  }

  /**
   * Send tokens to a recipient.
   * Opens popup for user approval.
   */
  async sendTokens(params: {
    recipient: string;
    coinId: string;
    amount: string;
    message?: string;
  }): Promise<{ transactionId: string }> {
    const response = await this.createRequest<{ transactionId: string }>('SPHERE_SEND_TOKENS', params);
    return { transactionId: response.transactionId };
  }

  /**
   * Sign an arbitrary message.
   * Opens popup for user approval.
   */
  async signMessage(message: string): Promise<string> {
    const response = await this.createRequest<{ signature: string }>('SPHERE_SIGN_MESSAGE', { message });
    return response.signature;
  }

  /**
   * Get the NOSTR public key for the active identity.
   */
  async getNostrPublicKey(): Promise<{ hex: string; npub: string }> {
    const response = await this.createRequest<{ publicKey: string; npub: string }>('SPHERE_GET_NOSTR_PUBLIC_KEY');
    return { hex: response.publicKey, npub: response.npub };
  }

  /**
   * Sign a NOSTR event hash.
   * Auto-approved for connected sites (no popup).
   */
  async signNostrEvent(eventHash: string): Promise<string> {
    const response = await this.createRequest<{ signature: string }>('SPHERE_SIGN_NOSTR_EVENT', { eventHash });
    return response.signature;
  }

  /**
   * NIP-44 encryption/decryption.
   * Auto-approved for connected sites (no popup).
   */
  nip44 = {
    encrypt: async (recipientPubkey: string, plaintext: string): Promise<string> => {
      const response = await this.createRequest<{ ciphertext: string }>(
        'SPHERE_NIP44_ENCRYPT',
        { recipientPubkey, plaintext }
      );
      return response.ciphertext;
    },

    decrypt: async (senderPubkey: string, ciphertext: string): Promise<string> => {
      const response = await this.createRequest<{ plaintext: string }>(
        'SPHERE_NIP44_DECRYPT',
        { senderPubkey, ciphertext }
      );
      return response.plaintext;
    },
  };

  /**
   * Get the user's registered nametag, if any.
   */
  async getMyNametag(): Promise<{ name: string; proxyAddress: string } | null> {
    const response = await this.createRequest<{ nametag: { nametag: string; proxyAddress: string } | null }>(
      'SPHERE_GET_MY_NAMETAG'
    );
    return response.nametag
      ? { name: response.nametag.nametag, proxyAddress: response.nametag.proxyAddress }
      : null;
  }

  /**
   * Resolve a nametag to its NOSTR pubkey and proxy address.
   *
   * @param nametag Nametag to resolve (e.g., "alice" or "@alice")
   * @returns Resolution info or null if not found
   */
  async resolveNametag(nametag: string): Promise<NametagResolution | null> {
    const response = await this.createRequest<{ resolution: NametagResolution | null }>(
      'SPHERE_RESOLVE_NAMETAG',
      { nametag }
    );
    return response.resolution;
  }

  /**
   * Check if a nametag is available for registration.
   *
   * @param nametag Nametag to check (e.g., "alice")
   * @returns true if available, false if already taken
   */
  async checkNametagAvailable(nametag: string): Promise<boolean> {
    const response = await this.createRequest<{ available: boolean }>(
      'SPHERE_CHECK_NAMETAG_AVAILABLE',
      { nametag }
    );
    return response.available;
  }
}

// Declare global type
declare global {
  interface Window {
    sphere?: SphereAPI;
  }
}

// Initialize and freeze the API
if (!window.sphere) {
  const sphere = new SphereAPI();

  Object.defineProperty(window, 'sphere', {
    value: sphere,
    writable: false,
    configurable: false,
  });

  // Dispatch ready event
  window.dispatchEvent(new CustomEvent('sphereReady'));

  console.log('Sphere API initialized');
}

export {};

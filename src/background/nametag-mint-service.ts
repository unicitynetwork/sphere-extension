/**
 * NametagMintService - handles nametag registration.
 *
 * For Phase 5, this service:
 * - Checks availability via NOSTR (if nametag has no binding, it's available)
 * - Publishes nametag binding to NOSTR
 * - Derives proxy address from nametag
 *
 * On-chain minting will be added in a future phase when we have
 * full integration with the Unicity SDK mint workflow.
 */

import { ProxyAddress } from '@unicitylabs/state-transition-sdk/lib/address/ProxyAddress';
import { nostrService } from './nostr-service';

// ============ Types ============

export type MintResult =
  | { status: 'success'; proxyAddress: string }
  | { status: 'error'; message: string };

// ============ NametagMintService ============

/**
 * Service for nametag registration operations.
 */
export class NametagMintService {
  /**
   * Check if a nametag is available for registration.
   *
   * In Phase 5, availability is determined by checking if the nametag
   * has a NOSTR binding. If no binding exists, it's available.
   *
   * @param nametag Nametag to check (without @)
   * @returns true if available, false if already taken
   */
  async isAvailable(nametag: string): Promise<boolean> {
    const cleanTag = this.cleanNametag(nametag);

    try {
      // Check if there's already a NOSTR binding for this nametag
      const existingPubkey = await nostrService.queryPubkeyByNametag(cleanTag);
      return existingPubkey === null;
    } catch (error) {
      console.error('[NametagMint] Error checking availability:', error);
      // If NOSTR query fails, we can't determine availability
      // Return false to be safe
      return false;
    }
  }

  /**
   * Register a nametag by publishing the NOSTR binding.
   *
   * Phase 5 implementation:
   * - Derives proxy address from nametag
   * - Publishes binding to NOSTR relay
   *
   * On-chain minting will be added in Phase 6+.
   *
   * @param nametag Nametag to register (without @)
   * @returns Result with proxy address or error
   */
  async register(nametag: string): Promise<MintResult> {
    const cleanTag = this.cleanNametag(nametag);

    try {
      // Check availability first
      const available = await this.isAvailable(cleanTag);
      if (!available) {
        return { status: 'error', message: 'Nametag is already taken' };
      }

      // Get the proxy address for this nametag
      const proxyAddress = await this.getProxyAddress(cleanTag);

      // Publish the NOSTR binding
      const published = await nostrService.publishNametagBinding(cleanTag, proxyAddress);
      if (!published) {
        return { status: 'error', message: 'Failed to publish nametag binding' };
      }

      console.log(`[NametagMint] Registered @${cleanTag} -> ${proxyAddress}`);
      return { status: 'success', proxyAddress };
    } catch (error) {
      console.error('[NametagMint] Registration error:', error);
      return {
        status: 'error',
        message: (error as Error).message || 'Registration failed',
      };
    }
  }

  /**
   * Get the proxy address for a nametag.
   */
  async getProxyAddress(nametag: string): Promise<string> {
    const cleanTag = this.cleanNametag(nametag);
    const proxyAddress = await ProxyAddress.fromNameTag(cleanTag);
    return proxyAddress.address;
  }

  // ============ Helpers ============

  private cleanNametag(nametag: string): string {
    return nametag.replace('@unicity', '').replace('@', '').trim().toLowerCase();
  }
}

// Singleton instance
export const nametagMintService = new NametagMintService();

/**
 * NametagMintService - handles nametag registration via Sphere SDK.
 *
 * Delegates to walletManager which uses Sphere SDK's registerNametag()
 * and isNametagAvailable() methods.
 */

import { walletManager } from './wallet-manager';

// ============ Types ============

export type MintResult =
  | { status: 'success'; proxyAddress: string }
  | { status: 'error'; message: string };

// ============ NametagMintService ============

export class NametagMintService {
  async isAvailable(nametag: string): Promise<boolean> {
    const cleanTag = nametag.replace('@unicity', '').replace('@', '').trim().toLowerCase();
    return walletManager.isNametagAvailable(cleanTag);
  }

  async register(nametag: string): Promise<MintResult> {
    const cleanTag = nametag.replace('@unicity', '').replace('@', '').trim().toLowerCase();

    try {
      const nametagInfo = await walletManager.registerNametag(cleanTag);
      return { status: 'success', proxyAddress: nametagInfo.proxyAddress };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error).message || 'Registration failed',
      };
    }
  }
}

// Singleton instance
export const nametagMintService = new NametagMintService();

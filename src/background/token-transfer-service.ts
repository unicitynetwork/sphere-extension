/**
 * TokenTransferService - handles incoming token transfers received via NOSTR.
 *
 * For Phase 6, this service:
 * - Processes TOKEN_TRANSFER events from NOSTR
 * - Handles DIRECT address transfers (immediate)
 * - Logs PROXY address transfers (full support in Phase 7+ when we have nametag tokens)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Token } from '@unicitylabs/state-transition-sdk/lib/token/Token';
import { TransferTransaction } from '@unicitylabs/state-transition-sdk/lib/transaction/TransferTransaction';
import { AddressScheme } from '@unicitylabs/state-transition-sdk/lib/address/AddressScheme';
import type { ReceivedTokenTransfer } from './nostr-service';

// ============ Types ============

export interface TokenTransferResult {
  success: boolean;
  tokenId?: string;
  amount?: string;
  coinId?: string;
  error?: string;
}

export interface TransferProcessorConfig {
  /**
   * Called when a token is successfully received.
   * Should add the token to the wallet and persist.
   */
  onTokenReceived: (
    tokenJson: string,
    transactionJson: string,
    senderPubkey: string
  ) => Promise<boolean>;

  /**
   * Get the stored nametag for proxy finalization.
   * Returns null if no nametag is registered.
   */
  getStoredNametag: () => Promise<{ name: string; tokenJson: string; proxyAddress: string } | null>;
}

// ============ TokenTransferService ============

/**
 * Service for processing incoming token transfers.
 */
export class TokenTransferService {
  private config: TransferProcessorConfig;

  constructor(config: TransferProcessorConfig) {
    this.config = config;
  }

  /**
   * Process an incoming token transfer from NOSTR.
   *
   * @param transfer The received transfer data
   * @returns true if successfully processed (should not retry)
   */
  async processTransfer(transfer: ReceivedTokenTransfer): Promise<boolean> {
    console.log('[TokenTransfer] Processing transfer from', transfer.senderPubkey.slice(0, 8) + '...');

    try {
      // Parse the source token and transaction
      const { sourceToken, transferTx } = await this.parseTransferData(transfer);
      if (!sourceToken || !transferTx) {
        console.error('[TokenTransfer] Failed to parse transfer data');
        return false;
      }

      // Check recipient address type
      const recipientAddress = transferTx.data.recipient;
      const addressScheme = recipientAddress.scheme;

      if (addressScheme === AddressScheme.PROXY) {
        // Proxy (nametag) address - needs finalization with nametag token
        return await this.handleProxyTransfer(sourceToken, transferTx, transfer);
      } else {
        // Direct address - can be received immediately
        return await this.handleDirectTransfer(sourceToken, transferTx, transfer);
      }
    } catch (error) {
      console.error('[TokenTransfer] Error processing transfer:', error);
      return false;
    }
  }

  /**
   * Parse transfer data from NOSTR event.
   */
  private async parseTransferData(transfer: ReceivedTokenTransfer): Promise<{
    sourceToken: Token<any> | null;
    transferTx: TransferTransaction | null;
  }> {
    try {
      let sourceTokenData = transfer.sourceToken;
      let transferTxData = transfer.transferTx;

      // Handle string inputs
      if (typeof sourceTokenData === 'string') {
        sourceTokenData = JSON.parse(sourceTokenData);
      }
      if (typeof transferTxData === 'string') {
        transferTxData = JSON.parse(transferTxData);
      }

      if (!sourceTokenData || !transferTxData) {
        return { sourceToken: null, transferTx: null };
      }

      const sourceToken = await Token.fromJSON(sourceTokenData);
      const transferTx = await TransferTransaction.fromJSON(transferTxData);

      return { sourceToken, transferTx };
    } catch (error) {
      console.error('[TokenTransfer] Parse error:', error);
      return { sourceToken: null, transferTx: null };
    }
  }

  /**
   * Handle transfer to a PROXY (nametag) address.
   *
   * This requires finalization with the nametag token as proof.
   * In Phase 6, we check if we have a stored nametag that matches.
   */
  private async handleProxyTransfer(
    sourceToken: Token<any>,
    transferTx: TransferTransaction,
    transfer: ReceivedTokenTransfer
  ): Promise<boolean> {
    console.log('[TokenTransfer] Proxy address transfer - checking nametag');

    // Get our stored nametag
    const storedNametag = await this.config.getStoredNametag();
    if (!storedNametag) {
      console.warn('[TokenTransfer] No nametag registered - cannot finalize proxy transfer');
      console.warn('[TokenTransfer] The sender should resend to your direct address');
      // Return true to not retry - we simply can't process this without a nametag
      return true;
    }

    // Check if the proxy address matches our nametag's proxy address
    const recipientAddress = transferTx.data.recipient;
    if (recipientAddress.address !== storedNametag.proxyAddress) {
      console.warn('[TokenTransfer] Proxy address does not match our nametag');
      console.warn(`  Received: ${recipientAddress.address}`);
      console.warn(`  Ours: ${storedNametag.proxyAddress}`);
      // Return true - this transfer isn't for us
      return true;
    }

    // In Phase 6, we don't have on-chain nametag tokens for full finalization
    // The nametag token is needed to create the proof for finalization
    // For now, log this and return true to mark as processed
    //
    // Full finalization flow (Phase 7+):
    // 1. Parse the nametag token from storedNametag.tokenJson
    // 2. Create signing service from identity
    // 3. Create UnmaskedPredicate with transfer salt
    // 4. Call client.finalizeTransaction with nametag token as proof
    // 5. Save finalized token to wallet

    console.log('[TokenTransfer] Proxy transfer received for @' + storedNametag.name);
    console.log('[TokenTransfer] Full finalization requires on-chain nametag token (Phase 7+)');

    // For now, try to receive as direct transfer (may work if sender included direct transfer data)
    // This is a fallback - proper proxy finalization needs the nametag token
    try {
      const tokenJson = JSON.stringify(sourceToken.toJSON());
      const txJson = JSON.stringify(transferTx.toJSON());

      const success = await this.config.onTokenReceived(
        tokenJson,
        txJson,
        transfer.senderPubkey
      );

      if (success) {
        console.log('[TokenTransfer] Token received (fallback direct receive)');
      }

      return success;
    } catch (error) {
      console.warn('[TokenTransfer] Fallback receive failed:', error);
      // Don't retry - need proper nametag token for proxy finalization
      return true;
    }
  }

  /**
   * Handle transfer to a DIRECT address.
   *
   * These can be received immediately without finalization.
   */
  private async handleDirectTransfer(
    sourceToken: Token<any>,
    transferTx: TransferTransaction,
    transfer: ReceivedTokenTransfer
  ): Promise<boolean> {
    console.log('[TokenTransfer] Direct address transfer - receiving');

    try {
      const tokenJson = JSON.stringify(sourceToken.toJSON());
      const txJson = JSON.stringify(transferTx.toJSON());

      const success = await this.config.onTokenReceived(
        tokenJson,
        txJson,
        transfer.senderPubkey
      );

      if (success) {
        console.log('[TokenTransfer] Token received successfully');
        this.logTokenInfo(sourceToken);
      }

      return success;
    } catch (error) {
      console.error('[TokenTransfer] Direct receive failed:', error);
      return false;
    }
  }

  /**
   * Log token information for debugging.
   */
  private logTokenInfo(token: Token<any>): void {
    try {
      // Just log that a token was received - detailed info requires SDK access
      console.log(`[TokenTransfer] Token ID: ${token.id?.toString().slice(0, 16)}...`);
    } catch {
      // Ignore logging errors
    }
  }
}

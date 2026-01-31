/**
 * Constants used throughout the extension.
 *
 * Coin IDs, symbols, and decimals sourced from:
 * https://github.com/unicitynetwork/unicity-ids/blob/main/unicity-ids.testnet.json
 */

/** UCT coin ID - the native Unicity testnet fungible token */
export const UCT_COIN_ID = '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89';

/** Legacy ALPHA coin ID (kept for backwards compatibility) */
export const ALPHA_COIN_ID = UCT_COIN_ID;

/** Known coin symbols by ID */
export const COIN_SYMBOLS: Record<string, string> = {
  '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89': 'UCT',
  '8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7': 'USDU',
  '5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925': 'EURU',
  'dee5f8ce778562eec90e9c38a91296a023210ccc76ff4c29d527ac3eb64ade93': 'SOL',
  '86bc190fcf7b2d07c6078de93db803578760148b16d4431aa2f42a3241ff0daa': 'BTC',
  '3c2450f2fd867e7bb60c6a69d7ad0e53ce967078c201a3ecaa6074ed4c0deafb': 'ETH',
  'cde78ded16ef65818a51f43138031c4284e519300ab0cb60c30a8f9078080e5f': 'ALPHT',
  '40d25444648418fe7efd433e147187a3a6adf049ac62bc46038bda5b960bf690': 'USDT',
  '2265121770fa6f41131dd9a6cc571e28679263d09a53eb2642e145b5b9a5b0a2': 'USDC',
};

/** Coin decimals by ID */
export const COIN_DECIMALS: Record<string, number> = {
  '455ad8720656b08e8dbd5bac1f3c73eeea5431565f6c1c3af742b1aa12d41d89': 18, // UCT
  '8f0f3d7a5e7297be0ee98c63b81bcebb2740f43f616566fc290f9823a54f52d7': 6,  // USDU
  '5e160d5e9fdbb03b553fb9c3f6e6c30efa41fa807be39fb4f18e43776e492925': 6,  // EURU
  'dee5f8ce778562eec90e9c38a91296a023210ccc76ff4c29d527ac3eb64ade93': 9,  // SOL
  '86bc190fcf7b2d07c6078de93db803578760148b16d4431aa2f42a3241ff0daa': 8,  // BTC
  '3c2450f2fd867e7bb60c6a69d7ad0e53ce967078c201a3ecaa6074ed4c0deafb': 18, // ETH
  'cde78ded16ef65818a51f43138031c4284e519300ab0cb60c30a8f9078080e5f': 8,  // ALPHT
  '40d25444648418fe7efd433e147187a3a6adf049ac62bc46038bda5b960bf690': 6,  // USDT
  '2265121770fa6f41131dd9a6cc571e28679263d09a53eb2642e145b5b9a5b0a2': 6,  // USDC
};

/** Default decimals for unknown coins */
export const DEFAULT_DECIMALS = 18;

/**
 * Format a token amount from smallest units to human-readable string.
 * @param amount Amount in smallest units (as string to handle bigint)
 * @param coinId Coin ID to look up decimals
 * @returns Formatted amount string
 */
export function formatTokenAmount(amount: string, coinId: string): string {
  const decimals = COIN_DECIMALS[coinId] ?? DEFAULT_DECIMALS;

  // Handle zero
  if (amount === '0') return '0';

  // Pad amount to at least decimals + 1 characters
  const padded = amount.padStart(decimals + 1, '0');

  // Split into integer and fractional parts
  const integerPart = padded.slice(0, -decimals) || '0';
  const fractionalPart = padded.slice(-decimals).replace(/0+$/, ''); // Trim trailing zeros

  if (fractionalPart) {
    return `${integerPart}.${fractionalPart}`;
  }
  return integerPart;
}

/** Default coin symbol */
export const DEFAULT_COIN_SYMBOL = 'UCT';

/** Default auto-lock timeout in minutes */
export const DEFAULT_AUTO_LOCK_TIMEOUT = 15;

/** Extension name for display */
export const EXTENSION_NAME = 'Sphere Wallet';

/** Default token type (32 bytes of 0x01) */
export const DEFAULT_TOKEN_TYPE = new Uint8Array(32).fill(0x01);

/** Gateway URL for Unicity Protocol (test network) */
export const GATEWAY_URL = 'https://goggregator-test.unicity.network';

/** NOSTR event kinds we support signing */
export const SUPPORTED_NOSTR_KINDS = [0, 1, 3, 4, 5, 6, 7];

/** Bech32 prefix for NOSTR public keys */
export const NOSTR_NPUB_PREFIX = 'npub';

/** NOSTR relay URL for nametag operations */
export const NOSTR_RELAY_URL = 'wss://nostr-relay.testnet.unicity.network';

/** Default NOSTR relays */
export const DEFAULT_NOSTR_RELAYS = [NOSTR_RELAY_URL];

/** Unicity token type (used for nametag tokens) */
export const UNICITY_TOKEN_TYPE_HEX =
  'f8aa13834268d29355ff12183066f0cb902003629bbc5eb9ef0efbe397867509';

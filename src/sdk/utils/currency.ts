/**
 * Currency conversion utilities.
 * Ported from sphere/src/components/wallet/L3/utils/currency.ts
 */

export const CurrencyUtils = {
  /**
   * Convert human-readable amount to smallest unit.
   * e.g., "1.5" with 18 decimals -> "1500000000000000000"
   */
  toSmallestUnit(amount: string, decimals: number): string {
    if (!amount || amount === '0') return '0';

    const parts = amount.split('.');
    const integerPart = parts[0] || '0';
    let fractionalPart = parts[1] || '';

    // Pad or truncate fractional part to match decimals
    if (fractionalPart.length > decimals) {
      fractionalPart = fractionalPart.slice(0, decimals);
    } else {
      fractionalPart = fractionalPart.padEnd(decimals, '0');
    }

    // Remove leading zeros from combined result
    const combined = (integerPart + fractionalPart).replace(/^0+/, '') || '0';
    return combined;
  },

  /**
   * Convert smallest unit to human-readable amount.
   * e.g., "1500000000000000000" with 18 decimals -> "1.5"
   */
  toHumanReadable(amount: string, decimals: number): string {
    if (!amount || amount === '0') return '0';
    if (decimals === 0) return amount;

    const padded = amount.padStart(decimals + 1, '0');
    const integerPart = padded.slice(0, -decimals) || '0';
    const fractionalPart = padded.slice(-decimals).replace(/0+$/, '');

    if (fractionalPart) {
      return `${integerPart}.${fractionalPart}`;
    }
    return integerPart;
  },
};

export const AmountFormatUtils = {
  /**
   * Format a display amount with proper locale formatting.
   */
  formatDisplayAmount(amount: string | number, maxDecimals: number = 6): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0';
    if (num === 0) return '0';

    // Use fixed notation to avoid scientific notation
    const fixed = num.toFixed(maxDecimals);
    // Remove trailing zeros after decimal point
    const trimmed = fixed.replace(/\.?0+$/, '');
    return trimmed || '0';
  },

  /**
   * Format fiat value for display.
   */
  formatFiatValue(value: number | null | undefined): string {
    if (value == null || isNaN(value)) return '$0.00';
    return `$${value.toFixed(2)}`;
  },
};

import { isSphereError, type SphereErrorCode } from '@unicitylabs/sphere-sdk';

// Friendly overrides for codes where SDK message is too technical.
// For codes NOT listed here, we use the SDK's own err.message (which is
// already user-readable, e.g. "Unicity ID @bob is already taken").
const FRIENDLY_OVERRIDES: Partial<Record<SphereErrorCode, string>> = {
  TRANSPORT_ERROR: 'Connection issue. Check your network',
  TIMEOUT: 'Request timed out. Try again',
  NETWORK_ERROR: 'Network error. Check your connection',
  AGGREGATOR_ERROR: 'Network unavailable. Try again',
  DECRYPTION_ERROR: 'Wrong password',
  STORAGE_ERROR: 'Storage error',
  MODULE_NOT_AVAILABLE: 'Feature not available',
};

export function getErrorMessage(err: unknown): string {
  if (isSphereError(err)) {
    return FRIENDLY_OVERRIDES[err.code] ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function getErrorCode(err: unknown): SphereErrorCode | null {
  return isSphereError(err) ? err.code : null;
}

export { isSphereError };

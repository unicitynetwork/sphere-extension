import { isSphereError, type SphereErrorCode } from '@unicitylabs/sphere-sdk';

const ERROR_MESSAGES: Record<SphereErrorCode, string> = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  INVALID_RECIPIENT: 'Recipient not found',
  TRANSPORT_ERROR: 'Connection issue. Check your network',
  TIMEOUT: 'Request timed out. Try again',
  NOT_INITIALIZED: 'Wallet not initialized',
  ALREADY_INITIALIZED: 'Wallet already exists',
  INVALID_CONFIG: 'Invalid configuration',
  INVALID_IDENTITY: 'Invalid recovery phrase',
  TRANSFER_FAILED: 'Transfer failed. Try again',
  STORAGE_ERROR: 'Storage error',
  AGGREGATOR_ERROR: 'Network unavailable. Try again',
  VALIDATION_ERROR: 'Invalid input',
  NETWORK_ERROR: 'Network error. Check your connection',
  DECRYPTION_ERROR: 'Wrong password',
  MODULE_NOT_AVAILABLE: 'Feature not available',
};

export function getErrorMessage(err: unknown): string {
  if (isSphereError(err)) {
    return ERROR_MESSAGES[err.code] ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function getErrorCode(err: unknown): SphereErrorCode | null {
  return isSphereError(err) ? err.code : null;
}

export { isSphereError };

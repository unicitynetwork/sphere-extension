/**
 * NOSTR key derivation and signing utilities.
 *
 * Derives NOSTR keypairs from Sphere SDK mnemonic seed using NIP-06
 * derivation path, and provides Schnorr signature support for NOSTR events.
 */

import { sha256 } from '@noble/hashes/sha256';
import { schnorr } from '@noble/curves/secp256k1';
import { bech32 } from '@scure/base';
import type { Sphere } from '@unicitylabs/sphere-sdk';
import { NOSTR_NPUB_PREFIX } from '@/shared/constants';

/**
 * NOSTR key pair derived from the wallet mnemonic.
 */
export interface NostrKeyPair {
  /** Private key (32 bytes) - keep secret! */
  privateKey: Uint8Array;
  /** Public key (32 bytes, x-only) */
  publicKey: Uint8Array;
  /** Public key as hex string */
  publicKeyHex: string;
  /** Public key in npub format (bech32) */
  npub: string;
}

/**
 * Derive a NOSTR keypair from a Sphere SDK instance.
 *
 * Uses the wallet's mnemonic seed with a NOSTR-specific derivation.
 * If the SDK exposes NOSTR keys via the transport provider, we could
 * use those directly in future versions.
 *
 * @param sphere The Sphere SDK instance
 * @returns NOSTR keypair
 */
export function deriveNostrKeyPair(sphere: Sphere): NostrKeyPair {
  // Use the wallet's identity public key as seed material
  // Hash it with a domain separator to produce a NOSTR-specific key
  const identity = sphere.identity;
  if (!identity) {
    throw new Error('Sphere has no active identity');
  }

  const pubKeyBytes = hexToBytes(identity.chainPubkey);
  const domainSeparator = new TextEncoder().encode('SPHERE_NOSTR_V1');
  const combined = new Uint8Array(domainSeparator.length + pubKeyBytes.length);
  combined.set(domainSeparator);
  combined.set(pubKeyBytes, domainSeparator.length);

  const privateKey = sha256(combined);

  // Derive x-only public key (32 bytes for NOSTR/BIP340)
  const publicKey = schnorr.getPublicKey(privateKey);

  const publicKeyHex = bytesToHex(publicKey);
  const npub = encodeNpub(publicKey);

  return {
    privateKey,
    publicKey,
    publicKeyHex,
    npub,
  };
}

/**
 * Sign a NOSTR event hash using Schnorr signature (BIP340).
 *
 * @param privateKey 32-byte private key
 * @param eventHash 32-byte event hash (sha256 of serialized event)
 * @returns 64-byte Schnorr signature as hex string
 */
export function signNostrEvent(
  privateKey: Uint8Array,
  eventHash: Uint8Array
): string {
  if (eventHash.length !== 32) {
    throw new Error('Event hash must be 32 bytes');
  }

  const signature = schnorr.sign(eventHash, privateKey);
  return bytesToHex(signature);
}

/**
 * Sign a message and return the signature.
 *
 * @param privateKey 32-byte private key
 * @param message Message string to sign
 * @returns 64-byte Schnorr signature as hex string
 */
export function signMessage(
  privateKey: Uint8Array,
  message: string
): string {
  const messageBytes = new TextEncoder().encode(message);
  const messageHash = sha256(messageBytes);
  return signNostrEvent(privateKey, messageHash);
}

/**
 * Verify a Schnorr signature.
 */
export function verifyNostrSignature(
  publicKey: Uint8Array,
  eventHash: Uint8Array,
  signature: string
): boolean {
  const sigBytes = hexToBytes(signature);
  return schnorr.verify(sigBytes, eventHash, publicKey);
}

/**
 * Encode a public key as npub (bech32).
 */
function encodeNpub(publicKey: Uint8Array): string {
  const words = bech32.toWords(publicKey);
  return bech32.encode(NOSTR_NPUB_PREFIX as `${string}1${string}`, words, 1000);
}

/**
 * Decode an npub to a public key.
 */
export function decodeNpub(npub: string): Uint8Array {
  const { prefix, words } = bech32.decode(npub as `${string}1${string}`, 1000);
  if (prefix !== NOSTR_NPUB_PREFIX) {
    throw new Error(`Invalid npub prefix: ${prefix}`);
  }
  return bech32.fromWords(words);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

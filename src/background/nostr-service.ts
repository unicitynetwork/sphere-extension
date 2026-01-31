/**
 * NostrService - DEPRECATED
 *
 * NOSTR operations are now handled by Sphere SDK's TransportProvider.
 * This file is kept as a thin compatibility shim for any remaining callers.
 * It delegates to the WalletManager's Sphere instance.
 */

// This module is intentionally empty.
// All NOSTR operations are now handled by sphere-sdk's NostrTransportProvider
// via WalletManager.createSphereFromMnemonic().
//
// If you need NOSTR functionality, use walletManager methods:
// - walletManager.resolveNametag() for nametag resolution
// - walletManager.registerNametag() for nametag registration
// - sphere.payments.send() for token transfers (SDK handles NOSTR delivery)
// - sphere.on('transfer:incoming', handler) for incoming transfers

export {};

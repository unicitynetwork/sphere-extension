/**
 * Background service worker entry point.
 *
 * This is the central hub for the extension, handling:
 * - Wallet operations via WalletManager
 * - Message routing between content scripts and popup
 * - Pending transaction management
 */

import { handleContentMessage, handlePopupMessage } from './message-handler';
import { getErrorMessage } from '@/sdk/errors';
import { initConnectHost, destroyConnectHost, isConnectHostActive, openPopupForConnect } from './connect-host';
import { isExtensionConnectEnvelope, EXT_MSG_TO_HOST } from '@unicitylabs/sphere-sdk/connect/browser';

console.log('Sphere Wallet background service worker started');

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Intercept Connect protocol envelopes (sphere-connect-ext:tohost).
  // Chrome calls ALL onMessage listeners, so ExtensionHostTransport will also
  // receive this message when it's registered (wallet unlocked).
  // Our job here: open the popup if the wallet is locked so the user can unlock first.
  if (isExtensionConnectEnvelope(message) && message.type === EXT_MSG_TO_HOST) {
    if (!isConnectHostActive()) {
      // Wallet locked — open popup so user can unlock, then retry Connect
      openPopupForConnect();
    }
    sendResponse({ handled: true });
    return true;
  }

  const { type } = message;

  if (!type) {
    sendResponse({ success: false, error: 'Missing message type' });
    return true;
  }

  // Route to appropriate handler
  const handler = type.startsWith('POPUP_')
    ? handlePopupMessage(message)
    : handleContentMessage(message, sender);

  handler
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      console.error('Message handler error:', error);
      sendResponse({
        success: false,
        error: getErrorMessage(error),
      });
    });

  // Return true to indicate async response
  return true;
});

// Initialize ConnectHost if wallet is already unlocked on startup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  initConnectHost();
}

// Re-initialize ConnectHost when wallet is unlocked/locked (triggered via message handler)
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'INTERNAL_WALLET_UNLOCKED') {
    initConnectHost();
  } else if (message?.type === 'INTERNAL_WALLET_LOCKED') {
    destroyConnectHost();
  }
  // Non-blocking — always return undefined (handled by primary listener above)
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Sphere Wallet extension installed:', details.reason);

  if (details.reason === 'install') {
    // First install - could show welcome page
    console.log('First install - welcome!');
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('Updated from version:', details.previousVersion);
  }
});

// Handle service worker startup (when browser starts or extension reloads)
chrome.runtime.onStartup.addListener(() => {
  console.log('Sphere Wallet service worker started');
});

// Export to make this a module
export {};

/**
 * Background service worker entry point.
 *
 * This is the central hub for the extension, handling:
 * - Wallet operations via WalletManager
 * - Message routing between content scripts and popup
 * - Pending transaction management
 */

import { handleContentMessage, handlePopupMessage } from './message-handler';

console.log('Sphere Wallet background service worker started');

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        error: error.message || 'Unknown error',
      });
    });

  // Return true to indicate async response
  return true;
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

/**
 * ExtensionTransport — Host-side Chrome Extension transport for Sphere Connect.
 *
 * Implements ConnectTransport for the extension background service worker.
 * Receives messages from content script via chrome.runtime.onMessage and
 * sends responses back via chrome.tabs.sendMessage.
 *
 * The dApp page sends messages via window.postMessage with type
 * 'sphere-connect-ext:tohost'. The content script relays them here.
 * Responses are sent back with type 'sphere-connect-ext:toclient'.
 */

import type { ConnectTransport, SphereConnectMessage } from '@unicitylabs/sphere-sdk/connect';
import { isSphereConnectMessage } from '@unicitylabs/sphere-sdk/connect';

export const EXT_MSG_TO_HOST = 'sphere-connect-ext:tohost';
export const EXT_MSG_TO_CLIENT = 'sphere-connect-ext:toclient';

interface ExtConnectEnvelope {
  type: typeof EXT_MSG_TO_HOST | typeof EXT_MSG_TO_CLIENT;
  payload: unknown;
}

function isExtConnectEnvelope(data: unknown): data is ExtConnectEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    ((data as ExtConnectEnvelope).type === EXT_MSG_TO_HOST ||
      (data as ExtConnectEnvelope).type === EXT_MSG_TO_CLIENT) &&
    'payload' in data
  );
}

export interface ExtensionHostMessagingApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage: { addListener(fn: (msg: unknown, sender: any) => void): void; removeListener(fn: (msg: unknown, sender: any) => void): void };
  tabs: { sendMessage(tabId: number, msg: unknown): void };
}

class ExtensionHostTransportImpl implements ConnectTransport {
  private handlers: Set<(message: SphereConnectMessage) => void> = new Set();
  private activeTabId: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listener: ((msg: unknown, sender: any) => void) | null = null;
  private readonly api: ExtensionHostMessagingApi;

  constructor(api: ExtensionHostMessagingApi) {
    this.api = api;

    this.listener = (msg: unknown, sender: { tab?: { id?: number } }) => {
      if (!isExtConnectEnvelope(msg)) return;
      if (msg.type !== EXT_MSG_TO_HOST) return;

      if (sender.tab?.id !== undefined) this.activeTabId = sender.tab.id;

      if (!isSphereConnectMessage(msg.payload)) return;
      for (const h of this.handlers) {
        try { h(msg.payload); } catch { /* ignore */ }
      }
    };

    this.api.onMessage.addListener(this.listener);
  }

  send(message: SphereConnectMessage): void {
    if (this.activeTabId === null) return;
    const envelope: ExtConnectEnvelope = { type: EXT_MSG_TO_CLIENT, payload: message };
    try { this.api.tabs.sendMessage(this.activeTabId, envelope); } catch { /* tab closed */ }
  }

  onMessage(handler: (message: SphereConnectMessage) => void): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  destroy(): void {
    if (this.listener) { this.api.onMessage.removeListener(this.listener); this.listener = null; }
    this.handlers.clear();
    this.activeTabId = null;
  }
}

export function createExtensionHostTransport(api: ExtensionHostMessagingApi): ConnectTransport {
  return new ExtensionHostTransportImpl(api);
}

/**
 * Receive view - show address, nametag, and QR code.
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';
import type { NametagInfo } from '@/shared/types';

export function Receive() {
  const { setView, myNametag } = useStore();
  const { getAddress, getMyNametag } = useWallet();
  const [address, setAddress] = useState('');
  const [nametag, setNametag] = useState<NametagInfo | null>(myNametag);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedNametag, setCopiedNametag] = useState(false);

  useEffect(() => {
    getAddress().then(setAddress).catch(console.error);
    getMyNametag().then(setNametag).catch(console.error);
  }, [getAddress, getMyNametag]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const copyNametag = async () => {
    if (!nametag) return;
    await navigator.clipboard.writeText(`@${nametag.nametag}`);
    setCopiedNametag(true);
    setTimeout(() => setCopiedNametag(false), 2000);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setView('dashboard')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-semibold">Receive</h2>
      </div>

      {/* Nametag Section */}
      {nametag ? (
        <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Your Nametag</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-mono text-purple-300">
              @{nametag.nametag}
            </div>
            <button
              onClick={copyNametag}
              className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
              title="Copy nametag"
            >
              {copiedNametag ? (
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Share this nametag to receive tokens easily
          </p>
        </div>
      ) : (
        <button
          onClick={() => setView('register-nametag')}
          className="w-full bg-gradient-to-r from-purple-600/20 to-blue-600/20
                     border border-purple-500/30 rounded-xl p-4 mb-4
                     hover:from-purple-600/30 hover:to-blue-600/30
                     transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center
                            group-hover:bg-purple-500/30 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-medium text-white">Register a Nametag</div>
              <div className="text-xs text-gray-400">
                Receive tokens with @yourname
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Address Card */}
      <div className="bg-gray-800 rounded-xl p-6">
        {/* Placeholder for QR Code */}
        <div className="w-40 h-40 mx-auto mb-4 bg-white rounded-lg p-3">
          <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
            <span className="text-gray-500 text-xs">QR Code</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-3 text-center">
          Direct Address
        </p>

        {/* Address */}
        <div className="bg-gray-900 rounded-lg p-3 mb-4">
          <div className="text-xs font-mono text-gray-300 break-all">
            {address || 'Loading...'}
          </div>
        </div>

        <button
          onClick={copyAddress}
          disabled={!address}
          className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800
                     text-white font-medium py-2 px-4 rounded-lg
                     transition-colors text-sm"
        >
          {copiedAddress ? 'Copied!' : 'Copy Address'}
        </button>
      </div>
    </div>
  );
}

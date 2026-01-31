/**
 * Pending transactions view - approve or reject pending requests.
 */

import { useStore } from '../store';
import { useWallet } from '../hooks/useWallet';
import type { PendingTransaction, SendTransactionData, SignMessageData, SignNostrData } from '@/shared/types';
import { formatTokenAmount, ALPHA_COIN_ID } from '@/shared/constants';

export function PendingTransactions() {
  const { pendingTransactions, loading, setView } = useStore();
  const { approveTransaction, rejectTransaction } = useWallet();

  if (pendingTransactions.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-400 py-12">
          No pending transactions
        </div>
        <button
          onClick={() => setView('dashboard')}
          className="text-purple-400 hover:text-purple-300"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const tx = pendingTransactions[0]!;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Approval Request</h2>
      <p className="text-sm text-gray-400 mb-6">
        {pendingTransactions.length} pending request{pendingTransactions.length > 1 ? 's' : ''}
      </p>

      <TransactionCard transaction={tx} />

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => rejectTransaction(tx.requestId)}
          disabled={loading}
          className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800
                     text-white font-medium py-3 px-4 rounded-lg
                     transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => approveTransaction(tx.requestId)}
          disabled={loading}
          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                     text-white font-medium py-3 px-4 rounded-lg
                     transition-colors"
        >
          {loading ? 'Approving...' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

function TransactionCard({ transaction }: { transaction: PendingTransaction }) {
  const { type, origin, data } = transaction;

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      {/* Origin */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-700">
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium">{new URL(origin).hostname}</div>
          <div className="text-xs text-gray-500">{origin}</div>
        </div>
      </div>

      {/* Transaction Details */}
      {type === 'send' && <SendDetails data={data as SendTransactionData} />}
      {type === 'sign_message' && <SignMessageDetails data={data as SignMessageData} />}
      {type === 'sign_nostr' && <SignNostrDetails data={data as SignNostrData} />}
    </div>
  );
}

function SendDetails({ data }: { data: SendTransactionData }) {
  const formatAmount = (amount: string): string => {
    // Format from smallest units to human-readable
    const formatted = formatTokenAmount(amount, data.coinId || ALPHA_COIN_ID);
    const num = parseFloat(formatted);
    return num.toLocaleString(undefined, { maximumFractionDigits: 8 });
  };

  const truncate = (str: string, len: number = 20): string => {
    if (str.length <= len) return str;
    return `${str.slice(0, len / 2)}...${str.slice(-len / 2)}`;
  };

  return (
    <div className="space-y-3">
      <div className="text-center">
        <div className="text-sm text-gray-400">Send</div>
        <div className="text-2xl font-bold text-white">
          {formatAmount(data.amount)} UCT
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">To</div>
        <div className="text-sm font-mono text-gray-300">
          {truncate(data.recipient, 32)}
        </div>
      </div>

      {data.message && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Message</div>
          <div className="text-sm text-gray-300">{data.message}</div>
        </div>
      )}
    </div>
  );
}

function SignMessageDetails({ data }: { data: SignMessageData }) {
  return (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <div className="text-sm text-gray-400">Sign Message</div>
      </div>

      <div className="bg-gray-900 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Message</div>
        <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-all">
          {data.message}
        </div>
      </div>
    </div>
  );
}

function SignNostrDetails({ data }: { data: SignNostrData }) {
  return (
    <div className="space-y-3">
      <div className="text-center mb-4">
        <div className="text-sm text-gray-400">Sign NOSTR Event</div>
      </div>

      <div className="bg-gray-900 rounded-lg p-3">
        <div className="text-xs text-gray-500 mb-1">Event Hash</div>
        <div className="text-sm text-gray-300 font-mono break-all">
          {data.eventHash}
        </div>
      </div>
    </div>
  );
}

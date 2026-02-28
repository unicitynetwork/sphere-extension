/**
 * ConnectIntentModal — handles dApp intents via Connect protocol.
 *
 * Routes each intent action to the appropriate wallet UI:
 *   send           → SendModal (L3 token transfer, prefilled)
 *   payment_request→ SendPaymentRequestModal (prefilled)
 *   l1_send        → inline L1 send form
 *   dm             → DM confirmation modal with auto-approve option
 *   sign_message   → sign message confirmation modal
 *   unknown        → unsupported message
 *
 * Intent result is sent back via POPUP_RESOLVE_CONNECT_INTENT.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Key, Zap, Loader2 } from 'lucide-react';
import { ERROR_CODES } from '@unicitylabs/sphere-sdk/connect';
import { BaseModal } from '@/components/ui/BaseModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Button } from '@/components/ui/Button';
import { SendModal } from './SendModal';
import { SendPaymentRequestModal } from './SendPaymentRequestModal';
import { POPUP_MESSAGES } from '@/shared/messages';

interface PendingIntent {
  id: string;
  action: string;
  params: Record<string, unknown>;
  session: {
    sessionId: string;
    dapp: { name: string; url: string; icon?: string };
  };
}

interface ConnectIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function resolveIntent(
  id: string,
  result: { result?: unknown; error?: { code: number; message: string } },
): Promise<void> {
  await chrome.runtime.sendMessage({ type: POPUP_MESSAGES.RESOLVE_CONNECT_INTENT, id, result });
}

async function rejectIntent(id: string, message = 'User cancelled'): Promise<void> {
  await resolveIntent(id, { error: { code: ERROR_CODES.USER_REJECTED, message } });
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConnectIntentModal({ isOpen, onClose }: ConnectIntentModalProps) {
  const [intent, setIntent] = useState<PendingIntent | null>(null);

  // Poll for pending intent when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const poll = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: POPUP_MESSAGES.GET_CONNECT_INTENT });
        if (response?.intent) {
          setIntent(response.intent);
        } else {
          setIntent(null);
        }
      } catch {
        // Background may not be ready
      }
    };

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleClose = useCallback(async () => {
    if (intent) await rejectIntent(intent.id);
    onClose();
  }, [intent, onClose]);

  if (!intent) return null;

  const { id, action, params, session } = intent;
  const dappName = session?.dapp?.name ?? 'Unknown dApp';

  // ── send ──────────────────────────────────────────────────────────────────
  if (action === 'send') {
    return (
      <SendModal
        isOpen={true}
        onClose={async (result) => {
          if (result?.success) {
            await resolveIntent(id, { result: { success: true } });
          } else {
            await rejectIntent(id);
          }
          onClose();
        }}
        prefill={{
          to: (params.to as string) ?? '',
          amount: (params.amount as string) ?? '',
          coinId: (params.coinId as string) ?? 'UCT',
          memo: params.memo as string | undefined,
        }}
      />
    );
  }

  // ── payment_request ───────────────────────────────────────────────────────
  if (action === 'payment_request') {
    return (
      <SendPaymentRequestModal
        isOpen={true}
        onClose={async (result) => {
          if (result?.success) {
            await resolveIntent(id, { result: { success: true, requestId: result.requestId } });
          } else {
            await rejectIntent(id);
          }
          onClose();
        }}
        prefill={{
          to: (params.to as string) ?? '',
          amount: (params.amount as string) ?? '',
          coinId: (params.coinId as string) ?? 'UCT',
          message: params.message as string | undefined,
        }}
      />
    );
  }

  // ── l1_send ───────────────────────────────────────────────────────────────
  if (action === 'l1_send') {
    return (
      <L1SendIntentModal
        isOpen={true}
        intent={intent}
        dappName={dappName}
        onClose={onClose}
      />
    );
  }

  // ── dm ────────────────────────────────────────────────────────────────────
  if (action === 'dm') {
    return (
      <DmIntentModal
        isOpen={true}
        intent={intent}
        dappName={dappName}
        onClose={onClose}
      />
    );
  }

  // ── sign_message ──────────────────────────────────────────────────────────
  if (action === 'sign_message') {
    return (
      <SignMessageIntentModal
        isOpen={true}
        intent={intent}
        dappName={dappName}
        onClose={onClose}
      />
    );
  }

  // ── unknown ───────────────────────────────────────────────────────────────
  return (
    <BaseModal isOpen={true} onClose={handleClose} size="sm">
      <ModalHeader title="Unsupported Request" onClose={handleClose} />
      <div className="p-6 text-center">
        <p className="text-neutral-500 mb-1 text-sm">Action not supported:</p>
        <code className="text-neutral-700 dark:text-neutral-300 text-sm bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
          {action}
        </code>
      </div>
      <div className="p-4 border-t border-neutral-200 dark:border-white/10">
        <Button variant="secondary" fullWidth onClick={handleClose}>Dismiss</Button>
      </div>
    </BaseModal>
  );
}

// ── L1 Send ──────────────────────────────────────────────────────────────────

type VestingMode = 'all' | 'vested' | 'unvested';

interface L1Balances {
  vested: string;
  unvested: string;
  total: string;
}

function formatAlpha(satoshis: string): string {
  const n = Number(satoshis);
  if (!n) return '0';
  return (n / 1e8).toFixed(4);
}

function L1SendIntentModal({
  isOpen,
  intent,
  dappName,
  onClose,
}: {
  isOpen: boolean;
  intent: PendingIntent;
  dappName: string;
  onClose: () => void;
}) {
  const { id, params } = intent;

  // Convert sats to ALPHA for display if amount looks like an integer in sats
  const rawAmount = (params.amount as string) ?? '';
  const defaultAmount =
    rawAmount && /^\d+$/.test(rawAmount) && Number(rawAmount) >= 1000
      ? (Number(rawAmount) / 1e8).toString()
      : rawAmount;

  const [to, setTo] = useState((params.to as string) ?? '');
  const [amount, setAmount] = useState(defaultAmount);
  const [vestingMode, setVestingMode] = useState<VestingMode>('all');
  const [balances, setBalances] = useState<L1Balances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch L1 vesting balances on mount
  useEffect(() => {
    let cancelled = false;
    chrome.runtime.sendMessage({ type: POPUP_MESSAGES.GET_L1_VESTING_BALANCES }).then((res) => {
      if (!cancelled && res) setBalances(res);
      if (!cancelled) setBalancesLoading(false);
    }).catch(() => {
      if (!cancelled) setBalancesLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleClose = useCallback(async () => {
    await rejectIntent(id);
    onClose();
  }, [id, onClose]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const amountAlpha = Number(amount);
      if (isNaN(amountAlpha) || amountAlpha <= 0) throw new Error('Invalid amount');
      const amountSatoshis = Math.round(amountAlpha * 1e8).toString();
      const result = await chrome.runtime.sendMessage({
        type: POPUP_MESSAGES.SEND_L1_TOKENS,
        to,
        amountSatoshis,
        vestingMode,
      });
      if (!result?.success) throw new Error(result?.error || 'L1 send failed');
      await resolveIntent(id, { result: { success: true, txHash: result.txHash } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setLoading(false);
    }
  };

  const vestingOptions: { value: VestingMode; label: string; balance: string; color: string }[] = [
    { value: 'all',      label: 'All',      balance: balances?.total   ?? '0', color: 'blue' },
    { value: 'vested',   label: 'Vested',   balance: balances?.vested  ?? '0', color: 'green' },
    { value: 'unvested', label: 'Unvested', balance: balances?.unvested ?? '0', color: 'orange' },
  ];

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} size="sm">
      <ModalHeader title="L1 Send Request" onClose={handleClose} />
      <div className="p-4 space-y-4">
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{dappName}</span> requests an L1 transfer
        </p>

        {/* Vesting mode selector */}
        <div>
          <label className="text-xs text-neutral-500 mb-1.5 block">Coin type</label>
          <div className="flex gap-2">
            {vestingOptions.map((opt) => {
              const isSelected = vestingMode === opt.value;
              const colorMap = {
                blue:   isSelected ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400',
                green:  isSelected ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400',
                orange: isSelected ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400',
              };
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVestingMode(opt.value)}
                  className={`flex-1 py-2 px-2 rounded-xl border-2 transition-all bg-neutral-100 dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-600 ${colorMap[opt.color as keyof typeof colorMap]}`}
                >
                  <div className="text-xs font-semibold">{opt.label}</div>
                  <div className="text-[10px] font-mono mt-0.5">
                    {balancesLoading
                      ? <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                      : `${formatAlpha(opt.balance)} ALPHA`
                    }
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Recipient address</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-neutral-900 dark:text-white font-mono text-xs outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1">
            <label className="text-xs text-neutral-500">Amount (ALPHA)</label>
            {balances && (
              <span className="text-[10px] text-neutral-400">
                Available: {formatAlpha(vestingOptions.find(o => o.value === vestingMode)?.balance ?? '0')} ALPHA
              </span>
            )}
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v); }}
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-neutral-900 dark:text-white font-mono outline-none focus:border-orange-500 text-lg"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>

      <div className="p-4 flex gap-2 border-t border-neutral-200 dark:border-white/10">
        <Button variant="secondary" fullWidth onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSend} loading={loading} disabled={!to || !amount}>
          Send
        </Button>
      </div>
    </BaseModal>
  );
}

// ── DM Intent ─────────────────────────────────────────────────────────────────

function DmIntentModal({
  isOpen,
  intent,
  dappName,
  onClose,
}: {
  isOpen: boolean;
  intent: PendingIntent;
  dappName: string;
  onClose: () => void;
}) {
  const { id, params } = intent;
  const to = params.to as string;
  const message = params.message as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);

  const handleClose = useCallback(async () => {
    await rejectIntent(id);
    onClose();
  }, [id, onClose]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await chrome.runtime.sendMessage({
        type: POPUP_MESSAGES.SEND_DM,
        recipient: to,
        content: message,
      });
      if (!result?.success) throw new Error(result?.error || 'DM failed');

      // Register auto-approve in background ConnectHost so future DMs skip popup
      if (autoApprove) {
        await chrome.runtime.sendMessage({ type: POPUP_MESSAGES.SET_DM_AUTO_APPROVE });
      }

      await resolveIntent(id, {
        result: { sent: true, messageId: result.id, timestamp: result.timestamp },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send DM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} size="sm">
      <ModalHeader title="DM Request" icon={MessageSquare} onClose={handleClose} />
      <div className="p-4 space-y-4">
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{dappName}</span> wants to send a DM
        </p>

        <div className="bg-neutral-100 dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-white/10">
          <div className="text-xs text-neutral-500 mb-1">
            To: <span className="text-neutral-700 dark:text-neutral-300 font-medium">{to}</span>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 text-neutral-700 dark:text-neutral-300 text-sm">
            {message}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="w-4 h-4 rounded accent-orange-500"
          />
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Allow this dApp to send DMs without confirmation
          </span>
        </label>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>

      <div className="p-4 flex gap-2 border-t border-neutral-200 dark:border-white/10">
        <Button variant="secondary" fullWidth onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSend} loading={loading} disabled={loading}>
          {loading ? 'Sending…' : 'Send DM'}
        </Button>
      </div>
    </BaseModal>
  );
}

// ── Sign Message Intent ───────────────────────────────────────────────────────

function SignMessageIntentModal({
  isOpen,
  intent,
  dappName,
  onClose,
}: {
  isOpen: boolean;
  intent: PendingIntent;
  dappName: string;
  onClose: () => void;
}) {
  const { id, params } = intent;
  const message = params.message as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signDoneRef = useRef(false);

  const handleClose = useCallback(async () => {
    if (!signDoneRef.current) await rejectIntent(id);
    onClose();
  }, [id, onClose]);

  const handleSign = async () => {
    setLoading(true);
    setError(null);
    try {
      const signResult = await chrome.runtime.sendMessage({
        type: POPUP_MESSAGES.SIGN_MESSAGE_CONNECT,
        message,
      });
      if (!signResult?.success) throw new Error(signResult?.error || 'Signing failed');
      signDoneRef.current = true;
      await resolveIntent(id, { result: { signature: signResult.signature } });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} size="sm">
      <ModalHeader title="Sign Message" icon={Key} onClose={handleClose} />
      <div className="p-4 space-y-4">
        <p className="text-xs text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{dappName}</span> requests a message signature
        </p>

        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Message</label>
          <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-xl p-3 text-neutral-700 dark:text-neutral-300 text-sm font-mono break-all max-h-40 overflow-y-auto">
            {message}
          </div>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <Zap size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Signing this message proves ownership of your wallet to the dApp.
          </p>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>

      <div className="p-4 flex gap-2 border-t border-neutral-200 dark:border-white/10">
        <Button variant="secondary" fullWidth onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" fullWidth onClick={handleSign} loading={loading} disabled={loading}>
          Sign
        </Button>
      </div>
    </BaseModal>
  );
}

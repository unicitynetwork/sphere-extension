import { useState } from 'react';
import { Plus, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useIdentity } from '@/sdk';
import { BaseModal, ModalHeader, Button } from '@/components/ui';

const FAUCET_API_URL = 'https://faucet.unicity.network/api/v1/faucet/request';

const FAUCET_COINS = [
  { coin: 'unicity', amount: 100 },
  { coin: 'bitcoin', amount: 1 },
  { coin: 'solana', amount: 1000 },
  { coin: 'ethereum', amount: 42 },
  { coin: 'tether', amount: 1000 },
  { coin: 'usd-coin', amount: 1000 },
  { coin: 'unicity-usd', amount: 1000 },
];

async function requestTokens(unicityId: string, coin: string, amount: number) {
  const response = await fetch(FAUCET_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unicityId, coin, amount }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to request ${coin}: ${response.statusText} - ${errorText}`);
  }
  return { success: true, coin, amount, ...(await response.json()) };
}

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
  const { nametag } = useIdentity();

  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState(false);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  const handleFaucetRequest = async () => {
    if (!nametag) return;

    setIsFaucetLoading(true);
    setFaucetError(null);
    setFaucetSuccess(false);

    try {
      const results = await Promise.all(
        FAUCET_COINS.map(({ coin, amount }) =>
          requestTokens(nametag, coin, amount).catch((error) => ({
            success: false,
            coin,
            amount,
            message: error instanceof Error ? error.message : 'Unknown error',
          }))
        )
      );
      const failedRequests = results.filter((r) => !r.success);

      if (failedRequests.length > 0) {
        const failedCoins = failedRequests.map((r) => r.coin).join(', ');
        setFaucetError(`Failed to request: ${failedCoins}`);
      } else {
        setFaucetSuccess(true);
        setTimeout(() => setFaucetSuccess(false), 3000);
      }
    } catch (error) {
      setFaucetError(error instanceof Error ? error.message : 'Failed to request tokens');
    } finally {
      setIsFaucetLoading(false);
    }
  };

  const handleClose = () => {
    setFaucetError(null);
    setFaucetSuccess(false);
    onClose();
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} showOrbs={false}>
      <ModalHeader title="Top Up" icon={Plus} onClose={handleClose} />

      <div className="px-6 py-3 flex-1 flex flex-col">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-orange-500" />
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            Request test tokens from the Unicity faucet
          </p>

          {!nametag ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              Nametag is required to request tokens
            </p>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={handleFaucetRequest}
                disabled={isFaucetLoading}
                loading={isFaucetLoading}
                loadingText="Requesting..."
                fullWidth
              >
                {faucetSuccess ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Success!
                  </span>
                ) : (
                  'Request All Coins'
                )}
              </Button>

              {faucetError && (
                <div className="mt-4 w-full flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">{faucetError}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </BaseModal>
  );
}

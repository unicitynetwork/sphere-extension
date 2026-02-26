import type { Token } from '@unicitylabs/sphere-sdk';
import { TokenRegistry } from '@unicitylabs/sphere-sdk';
import { Box, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { useState, memo } from 'react';

interface TokenRowProps {
  token: Token;
  delay: number;
  /** If true, animate entrance. If false, render without animation (token was already shown) */
  isNew?: boolean;
}

// Custom comparison: allow re-render when amount changes
function areTokenPropsEqual(prev: TokenRowProps, next: TokenRowProps): boolean {
  return (
    prev.token.id === next.token.id &&
    prev.token.status === next.token.status &&
    prev.token.symbol === next.token.symbol &&
    prev.isNew === next.isNew &&
    prev.delay === next.delay
  );
}

// Helper to parse token amount to numeric value
function parseTokenAmount(amount: string | undefined, coinId: string | undefined): number {
  try {
    if (!amount || !coinId) return 0;
    const amountFloat = parseFloat(amount);
    const registry = TokenRegistry.getInstance();
    const def = registry.getDefinition(coinId);
    const decimals = def?.decimals ?? 6;
    const divisor = Math.pow(10, decimals);
    return amountFloat / divisor;
  } catch {
    return 0;
  }
}

// Helper to format numeric value back to display string
function formatTokenAmount(value: number, coinId: string | undefined): string {
  try {
    if (!coinId) return value.toString();
    const registry = TokenRegistry.getInstance();
    const def = registry.getDefinition(coinId);
    const decimals = def?.decimals ?? 6;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: Math.min(decimals, 6)
    }).format(value);
  } catch {
    return value.toString();
  }
}

// Static token amount display (replaces AnimatedTokenAmount)
function TokenAmountDisplay({ amount, coinId, symbol }: {
  amount: string | undefined;
  coinId: string | undefined;
  symbol: string | undefined;
}) {
  const numericAmount = parseTokenAmount(amount, coinId);
  const formatted = formatTokenAmount(numericAmount, coinId);
  return <span>{formatted} {symbol || ''}</span>;
}

export const TokenRow = memo(function TokenRow({ token, delay, isNew = true }: TokenRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const className = "p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200/50 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10 transition-all group";

  const amountDisplay = (
    <TokenAmountDisplay
      amount={token.amount}
      coinId={token.coinId}
      symbol={token.symbol}
    />
  );

  const tokenContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
          {(token.iconUrl || TokenRegistry.getInstance().getIconUrl(token.coinId)) ? (
            <img src={token.iconUrl || TokenRegistry.getInstance().getIconUrl(token.coinId)!} alt={token.symbol} className="w-full h-full object-cover" />
          ) : (
            <Box className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
          )}
        </div>
        <div>
          <div className="text-neutral-900 dark:text-white font-medium text-sm">
            {amountDisplay}
          </div>
          <div
            className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono cursor-pointer hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
            onClick={handleCopyId}
          >
            <span>ID: {token.id.slice(0, 8)}...</span>
            {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {token.status === 'confirmed' ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            Confirmed
          </span>
        ) : token.status === 'transferring' ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Sending
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Pending
          </span>
        )}
        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
          {new Date(token.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {tokenContent}
    </div>
  );
}, areTokenPropsEqual);

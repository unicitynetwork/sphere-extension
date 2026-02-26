import { type Asset, TokenRegistry } from '@unicitylabs/sphere-sdk';
import { Box, Loader2 } from 'lucide-react';
import { memo } from 'react';

interface AssetRowProps {
  asset: Asset;
  showBalances: boolean;
  delay: number;
  onClick?: () => void;
  layer?: 'L1' | 'L3';
  /** If true, animate entrance. If false, render without animation (asset was already shown) */
  isNew?: boolean;
}

// Custom comparison: allow re-render when amount or price changes
function areAssetPropsEqual(prev: AssetRowProps, next: AssetRowProps): boolean {
  return (
    prev.asset.coinId === next.asset.coinId &&
    prev.asset.symbol === next.asset.symbol &&
    prev.asset.totalAmount === next.asset.totalAmount &&
    prev.asset.tokenCount === next.asset.tokenCount &&
    prev.asset.unconfirmedTokenCount === next.asset.unconfirmedTokenCount &&
    prev.asset.transferringTokenCount === next.asset.transferringTokenCount &&
    prev.asset.priceUsd === next.asset.priceUsd &&
    prev.asset.change24h === next.asset.change24h &&
    prev.asset.iconUrl === next.asset.iconUrl &&
    prev.showBalances === next.showBalances &&
    prev.layer === next.layer &&
    prev.isNew === next.isNew &&
    prev.delay === next.delay
  );
}

// Static fiat value display (replaces AnimatedFiatValue)
function FiatValue({ value, showBalances }: { value: number; showBalances: boolean }) {
  if (!showBalances) return <span>••••••</span>;
  const formatted = `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <span>{formatted}</span>;
}

// Static amount display (replaces AnimatedAmount)
function AmountDisplay({ value, symbol, decimals, showBalances }: {
  value: number;
  symbol: string;
  decimals: number;
  showBalances: boolean;
}) {
  if (!showBalances) return <span>••••</span>;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(decimals, 4),
    maximumFractionDigits: Math.min(decimals, 4)
  });
  return <span>{formatted} {symbol}</span>;
}

export const AssetRow = memo(function AssetRow({ asset, showBalances, delay, onClick, layer, isNew = true }: AssetRowProps) {
  const change24h = asset.change24h ?? 0;
  const changeColor = change24h >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  const changeSign = change24h >= 0 ? '+' : '';

  const fiatValue = asset.fiatValueUsd ?? 0;
  const numericAmount = Number(asset.totalAmount) / Math.pow(10, asset.decimals);

  const className = `p-3 rounded-xl transition-all group border border-transparent hover:border-neutral-200/50 dark:hover:border-white/5 ${onClick ? 'cursor-pointer hover:translate-x-1' : ''}`;

  const content = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
          {(asset.iconUrl || TokenRegistry.getInstance().getIconUrl(asset.coinId)) ? (
            <img
              src={asset.iconUrl || TokenRegistry.getInstance().getIconUrl(asset.coinId)!}
              alt={asset.symbol}
              className="w-full h-full object-cover"
            />
          ) : (
            <Box className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <div className="text-neutral-900 dark:text-white font-medium text-sm">{asset.symbol}</div>
            {layer && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                layer === 'L1'
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
              }`}>
                {layer}
              </span>
            )}
            <div className="text-xs text-neutral-500 truncate max-w-25">
              {asset.name}
            </div>
            {asset.transferringTokenCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {asset.transferringTokenCount} sending
              </span>
            )}
            {asset.unconfirmedTokenCount - asset.transferringTokenCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {asset.unconfirmedTokenCount - asset.transferringTokenCount} pending
              </span>
            )}
          </div>
          <div className="text-xs text-left text-neutral-500">
            <AmountDisplay
              value={numericAmount}
              symbol={asset.symbol}
              decimals={asset.decimals}
              showBalances={showBalances}
            />
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-neutral-900 dark:text-white font-medium text-sm">
          <FiatValue value={fiatValue} showBalances={showBalances} />
        </div>
        <div className={`text-xs ${changeColor} flex justify-end items-center`}>
          {changeSign}{change24h.toFixed(2)}%
        </div>
      </div>
    </div>
  );

  return (
    <div className={className} onClick={onClick}>
      {content}
    </div>
  );
}, areAssetPropsEqual);

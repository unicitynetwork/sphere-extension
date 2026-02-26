import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useIdentity } from '@/sdk';

/** Truncate long nametags: show first 6 chars + ... + last 3 chars */
function truncateNametag(nametag: string, maxLength: number = 20): string {
  if (nametag.length <= maxLength) return nametag;
  return `${nametag.slice(0, 6)}...${nametag.slice(-3)}`;
}

interface AddressSelectorProps {
  /** Compact mode - just show nametag with copy button */
  compact?: boolean;
}

export function AddressSelector({ compact = true }: AddressSelectorProps) {
  const [copied, setCopied] = useState<'nametag' | 'address' | false>(false);
  const { nametag, directAddress } = useIdentity();

  const handleCopyNametag = useCallback(async () => {
    if (!nametag) return;
    try {
      await navigator.clipboard.writeText(`@${nametag}`);
      setCopied('nametag');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy nametag:', err);
    }
  }, [nametag]);

  const handleCopyDirectAddress = useCallback(async () => {
    if (!directAddress) return;
    try {
      await navigator.clipboard.writeText(directAddress);
      setCopied('address');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy direct address:', err);
    }
  }, [directAddress]);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {nametag ? (
          <>
            <span className="text-[10px] sm:text-xs text-neutral-500 font-medium" title={`@${nametag}`}>
              @{truncateNametag(nametag)}
            </span>
            <button
              onClick={handleCopyNametag}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded transition-colors"
              title="Copy nametag"
            >
              {copied === 'nametag' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-neutral-500" />
              )}
            </button>
          </>
        ) : directAddress ? (
          <>
            <span className="text-[10px] sm:text-xs font-mono text-neutral-400">
              {directAddress.slice(0, 8)}...{directAddress.slice(-4)}
            </span>
            <button
              onClick={handleCopyDirectAddress}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded transition-colors"
              title={`Copy direct address: ${directAddress}`}
            >
              {copied === 'address' ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-neutral-400" />
              )}
            </button>
          </>
        ) : null}
      </div>
    );
  }

  // Full mode (placeholder for future use)
  return (
    <div className="flex items-center gap-2">
      {nametag ? (
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">@{nametag}</span>
      ) : directAddress ? (
        <span className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
          {directAddress.slice(0, 8)}...{directAddress.slice(-6)}
        </span>
      ) : (
        <span className="text-sm font-mono text-neutral-400">...</span>
      )}
    </div>
  );
}

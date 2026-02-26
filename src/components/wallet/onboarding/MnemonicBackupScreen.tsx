/**
 * MnemonicBackupScreen - Extension-specific screen for mnemonic backup
 * Shows the generated mnemonic words in a grid for user backup
 * Uses same styling patterns as the rest of the onboarding flow
 */
import { ShieldAlert, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

interface MnemonicBackupScreenProps {
  mnemonic: string;
  onConfirm: () => void;
}

export function MnemonicBackupScreen({
  mnemonic,
  onConfirm,
}: MnemonicBackupScreenProps) {
  const [copied, setCopied] = useState(false);
  const words = mnemonic.split(" ");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is not available
      const textarea = document.createElement("textarea");
      textarea.value = mnemonic;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [mnemonic]);

  return (
    <div className="relative z-10 w-full max-w-95">
      {/* Warning Icon */}
      <div className="relative w-18 h-18 mx-auto mb-5">
        <div className="absolute inset-0 bg-amber-500/30 rounded-2xl blur-xl" />
        <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/25">
          <ShieldAlert className="w-9 h-9 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
        Back Up Recovery Phrase
      </h2>

      <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-5 mx-auto leading-relaxed">
        Write down these 12 words in order and keep them safe.{" "}
        <span className="text-amber-500 dark:text-amber-400 font-semibold">
          This is the only way to recover your wallet.
        </span>
      </p>

      {/* Mnemonic word grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {words.map((word, index) => (
          <div
            key={`mnemonic-word-${index}`}
            className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-lg py-2.5 px-3"
          >
            <span className="text-xs text-neutral-400 dark:text-neutral-600 font-medium min-w-[1.25rem]">
              {index + 1}.
            </span>
            <span className="text-sm font-medium text-neutral-900 dark:text-white">
              {word}
            </span>
          </div>
        ))}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 mx-auto mb-5 px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-500">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy to clipboard</span>
          </>
        )}
      </button>

      {/* Warning notice */}
      <div className="mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          Never share your recovery phrase with anyone. Anyone with these words
          can access your wallet and funds.
        </p>
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        className="relative w-full py-3.5 px-5 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 overflow-hidden group"
      >
        <div className="absolute inset-0 bg-linear-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10">
          I've Saved My Recovery Phrase
        </span>
      </button>
    </div>
  );
}

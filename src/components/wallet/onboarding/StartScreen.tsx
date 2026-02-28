/**
 * StartScreen - Initial onboarding screen
 * Ported from sphere web app — no passwords, clean layout
 */
import { ArrowRight, Loader2, KeyRound } from "lucide-react";
import { UnionIcon } from "@/components/ui/UnionIcon";

interface StartScreenProps {
  isBusy: boolean;
  error: string | null;
  progressMessage?: string | null;
  onCreateWallet: () => void;
  onRestore: () => void;
}

export function StartScreen({
  isBusy,
  error,
  progressMessage,
  onCreateWallet,
  onRestore,
}: StartScreenProps) {
  return (
    <div className="relative z-10 w-full max-w-90">
      {/* Icon with glow effect */}
      <div className="relative w-18 h-18 mx-auto mb-6">
        <div className="absolute inset-0 bg-linear-to-br from-orange-500 to-orange-600 rounded-2xl blur-xl opacity-45" />
        <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/25">
          <UnionIcon size={36} />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
        No Wallet Found
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-7 mx-auto leading-relaxed">
        Create a new secure wallet to start using{" "}
        <span className="text-orange-500 dark:text-orange-400 font-semibold whitespace-nowrap">
          the Unicity Network
        </span>
      </p>

      <button
        onClick={onCreateWallet}
        disabled={isBusy}
        className="relative w-full py-3.5 px-5 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
      >
        <div className="absolute inset-0 bg-linear-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative z-10 flex items-center gap-2">
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create New Wallet
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </span>
      </button>

      {isBusy && progressMessage && (
        <div className="flex items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400 text-[11px] mt-2.5">
          <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
          <span>{progressMessage}</span>
        </div>
      )}

      <button
        onClick={onRestore}
        disabled={isBusy}
        className="relative w-full py-3.5 px-5 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 text-sm font-bold border border-neutral-200 dark:border-neutral-700/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-3 hover:bg-neutral-200 dark:hover:bg-neutral-700/50 transition-colors"
      >
        <KeyRound className="w-4 h-4" />
        Restore Wallet
      </button>

      {error && (
        <p className="mt-3 text-red-500 dark:text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

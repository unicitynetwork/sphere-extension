/**
 * StartScreen - Initial onboarding screen
 * Extension-adapted: includes password input for wallet creation (encrypted storage)
 * Removed: "Continue Setup", IPNS checking, framer-motion
 */
import {
  Wallet,
  ArrowRight,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";

interface StartScreenProps {
  isBusy: boolean;
  error: string | null;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onCreateWallet: () => void;
  onRestore: () => void;
}

export function StartScreen({
  isBusy,
  error,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onCreateWallet,
  onRestore,
}: StartScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password && confirmPassword && !isBusy) {
      onCreateWallet();
    }
  };

  return (
    <div className="relative z-10 w-full max-w-90">
      {/* Icon with glow effect */}
      <div className="relative w-18 h-18 mx-auto mb-6">
        <div className="absolute inset-0 bg-linear-to-br from-orange-500 to-orange-600 rounded-2xl blur-xl opacity-45" />
        <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/25">
          <Wallet className="w-9 h-9 text-white" />
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

      {/* Password inputs for wallet creation */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Create password (min 8 characters)"
            disabled={isBusy}
            className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-xl py-3 pl-3 pr-10 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-800 transition-all disabled:opacity-50"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Confirm password"
            disabled={isBusy}
            className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-xl py-3 pl-3 pr-10 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-orange-500 focus:bg-white dark:focus:bg-neutral-800 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        onClick={onCreateWallet}
        disabled={isBusy || !password || !confirmPassword}
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

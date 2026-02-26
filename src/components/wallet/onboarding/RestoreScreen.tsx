/**
 * RestoreScreen - Mnemonic recovery phrase input screen
 * Extension-adapted: includes password fields for encrypted storage
 * Removed: framer-motion animations
 */
import { KeyRound, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface RestoreScreenProps {
  seedWords: string[];
  isBusy: boolean;
  error: string | null;
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSeedWordsChange: (words: string[]) => void;
  onRestore: () => void;
  onBack: () => void;
}

export function RestoreScreen({
  seedWords,
  isBusy,
  error,
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSeedWordsChange,
  onRestore,
  onBack,
}: RestoreScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...seedWords];
    newWords[index] = value;
    onSeedWordsChange(newWords);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text").trim();
    const words = pastedText.split(/\s+/).filter((w) => w.length > 0);
    // If pasted text contains multiple words, fill all fields
    if (words.length > 1) {
      e.preventDefault();
      const newWords = Array(12).fill("");
      words.slice(0, 12).forEach((word, i) => {
        newWords[i] = word.toLowerCase();
      });
      onSeedWordsChange(newWords);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" && index < 11) {
      const nextInput = (e.currentTarget as HTMLElement).parentElement
        ?.nextElementSibling?.querySelector("input");
      nextInput?.focus();
    } else if (e.key === "Enter" && index === 11) {
      // Focus the password field
      const passwordInput = document.getElementById("restore-password");
      passwordInput?.focus();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isComplete && password && confirmPassword && !isBusy) {
      onRestore();
    }
  };

  const isComplete = seedWords.every((w) => w.trim());

  return (
    <div className="relative z-10 w-full max-w-95">
      {/* Icon */}
      <div className="relative w-18 h-18 mx-auto mb-6">
        <div className="absolute inset-0 bg-blue-500/30 rounded-2xl blur-xl" />
        <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/25">
          <KeyRound className="w-9 h-9 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
        Restore Wallet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 mx-auto leading-relaxed">
        Enter your 12-word recovery phrase to restore your wallet
      </p>

      {/* 12-word grid */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={`seed-input-${index}`} className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 dark:text-neutral-600 font-medium z-10">
              {index + 1}.
            </span>
            <input
              type="text"
              value={seedWords[index]}
              onChange={(e) => handleWordChange(index, e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder="word"
              className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-lg py-2.5 pl-8 pr-2 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 transition-all"
              autoFocus={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Password inputs for encrypted storage */}
      <div className="space-y-3 mb-5">
        <div className="relative">
          <input
            id="restore-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={handlePasswordKeyDown}
            placeholder="Create password (min 8 characters)"
            disabled={isBusy}
            className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-xl py-3 pl-3 pr-10 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 transition-all disabled:opacity-50"
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
            onKeyDown={handlePasswordKeyDown}
            placeholder="Confirm password"
            disabled={isBusy}
            className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700/50 rounded-xl py-3 pl-3 pr-10 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-neutral-800 transition-all disabled:opacity-50"
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

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isBusy}
          className="flex-1 py-3.5 px-5 rounded-xl bg-neutral-100 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 text-sm font-bold border border-neutral-200 dark:border-neutral-700/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 dark:hover:bg-neutral-700/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <button
          onClick={onRestore}
          disabled={isBusy || !isComplete || !password || !confirmPassword}
          className="flex-2 relative py-3.5 px-5 rounded-xl bg-linear-to-r from-blue-500 to-blue-600 text-white text-sm font-bold shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
        >
          <div className="absolute inset-0 bg-linear-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative z-10 flex items-center gap-2">
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                Restore
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </span>
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-500 dark:text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

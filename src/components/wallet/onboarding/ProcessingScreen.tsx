/**
 * ProcessingScreen - Shows progress during wallet creation/import
 * Ported from sphere web app — CSS animations instead of framer-motion
 */
import { Loader2, CheckCircle2 } from "lucide-react";

interface ProcessingScreenProps {
  status: string;
  currentStep?: number;
  totalSteps?: number;
  title?: string;
  completeTitle?: string;
  completeButtonText?: string;
  isComplete?: boolean;
  onComplete?: () => void;
}

export function ProcessingScreen({
  status,
  currentStep = 0,
  totalSteps = 3,
  title = "Setting up Profile...",
  completeTitle = "Profile Ready!",
  completeButtonText = "Let's go!",
  isComplete = false,
  onComplete,
}: ProcessingScreenProps) {
  return (
    <div className="relative z-10 text-center w-full max-w-90">
      {/* Loading Spinner or Success Icon */}
      <div className="relative mx-auto w-22 h-22 mb-6">
        {!isComplete ? (
          <>
            {/* Outer Ring */}
            <div
              className="absolute inset-0 border-3 border-neutral-200 dark:border-neutral-800/50 rounded-full animate-spin"
              style={{ animationDuration: "3s" }}
            />
            {/* Middle Ring */}
            <div
              className="absolute inset-1.5 border-3 border-orange-500/30 rounded-full border-t-orange-500 border-r-orange-500 animate-spin"
              style={{ animationDirection: "reverse", animationDuration: "2s" }}
            />
            {/* Inner Glow */}
            <div className="absolute inset-3 bg-orange-500/20 rounded-full blur-xl" />
            {/* Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-orange-500 dark:text-orange-400 animate-spin" />
            </div>
          </>
        ) : (
          /* Success State */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl" />
              <CheckCircle2 className="w-22 h-22 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
        )}
      </div>

      <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-5 tracking-tight">
        {isComplete ? completeTitle : title}
      </h3>

      {/* Dynamic Progress Status */}
      <div className="space-y-2 text-xs">
        {/* Current status indicator */}
        <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 bg-orange-50 dark:bg-orange-900/20 px-3 py-2.5 rounded-lg border border-orange-200 dark:border-orange-700/30">
          <div className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 shrink-0 animate-pulse" />
          <span className="text-left font-medium">
            {status || "Initializing..."}
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                isComplete
                  ? "bg-emerald-500"
                  : i < currentStep
                    ? "bg-emerald-500"
                    : i === currentStep
                      ? "bg-orange-500"
                      : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            />
          ))}
        </div>
      </div>

      {!isComplete && (
        <p className="mt-4 text-[10px] text-neutral-400 dark:text-neutral-500">
          This may take a few moments...
        </p>
      )}

      {/* Complete Button */}
      {isComplete && onComplete && (
        <button
          onClick={onComplete}
          className="mt-6 w-full px-5 py-3.5 bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {completeButtonText}
        </button>
      )}
    </div>
  );
}

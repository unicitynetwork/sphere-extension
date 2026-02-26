/**
 * CreateWalletFlow - Main onboarding flow component
 * Extension-adapted: no framer-motion, password-based wallet creation
 * Uses state-based conditional rendering instead of AnimatePresence
 */
import { useOnboardingFlow } from "./useOnboardingFlow";
import { StartScreen } from "./StartScreen";
import { RestoreScreen } from "./RestoreScreen";
import { MnemonicBackupScreen } from "./MnemonicBackupScreen";
import { NametagScreen } from "./NametagScreen";

export type { OnboardingStep } from "./useOnboardingFlow";

export function CreateWalletFlow() {
  const {
    // Step management
    step,
    setStep,
    goToStart,

    // State
    isBusy,
    error,

    // Password state
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,

    // Mnemonic restore state
    seedWords,
    setSeedWords,

    // Generated mnemonic
    generatedMnemonic,

    // Nametag state
    nametagInput,
    setNametagInput,
    nametagAvailability,

    // Processing state
    processingStatus,
    processingTitle,
    processingCompleteTitle,
    isProcessingComplete,

    // Actions
    handleCreateWallet,
    handleRestoreWallet,
    handleMnemonicBackupConfirm,
    handleMintNametag,
    handleSkipNametag,
    handleCompleteOnboarding,
  } = useOnboardingFlow();

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 text-center relative">
      {step === "start" && (
        <StartScreen
          isBusy={isBusy}
          error={error}
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onCreateWallet={handleCreateWallet}
          onRestore={() => setStep("restore")}
        />
      )}

      {step === "restore" && (
        <RestoreScreen
          seedWords={seedWords}
          isBusy={isBusy}
          error={error}
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSeedWordsChange={setSeedWords}
          onRestore={handleRestoreWallet}
          onBack={goToStart}
        />
      )}

      {step === "mnemonicBackup" && generatedMnemonic && (
        <MnemonicBackupScreen
          mnemonic={generatedMnemonic}
          onConfirm={handleMnemonicBackupConfirm}
        />
      )}

      {step === "nametag" && (
        <NametagScreen
          nametagInput={nametagInput}
          isBusy={isBusy}
          error={error}
          availability={nametagAvailability}
          onNametagChange={setNametagInput}
          onSubmit={handleMintNametag}
          onSkip={handleSkipNametag}
          onBack={goToStart}
        />
      )}

      {step === "processing" && (
        <div className="relative z-10 w-full max-w-90">
          <div className="relative w-18 h-18 mx-auto mb-6">
            {isProcessingComplete ? (
              <>
                <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl" />
                <div className="relative w-full h-full rounded-full bg-neutral-100 dark:bg-neutral-800/80 border-2 border-emerald-500/50 flex items-center justify-center">
                  <svg className="w-9 h-9 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-orange-500/30 rounded-2xl blur-xl" />
                <div className="relative w-full h-full rounded-2xl bg-linear-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/25">
                  <svg className="w-9 h-9 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              </>
            )}
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
            {isProcessingComplete ? processingCompleteTitle : processingTitle}
          </h2>

          <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">
            {processingStatus}
          </p>

          {isProcessingComplete && (
            <button
              onClick={handleCompleteOnboarding}
              className="relative w-full py-3.5 px-5 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 overflow-hidden group"
            >
              <div className="absolute inset-0 bg-linear-to-r from-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative z-10">Let's Go!</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

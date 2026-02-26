/**
 * CreateWalletFlow - Main onboarding flow component
 * Extension-adapted: no framer-motion, password-based wallet creation
 *
 * Create flow:  start → nametag → passwordSetup → processing → mnemonicBackup → done
 * Restore flow: start → restoreMethod → restore → passwordSetup → processing → done
 */
import { useOnboardingFlow } from "./useOnboardingFlow";
import { StartScreen } from "./StartScreen";
import { RestoreMethodScreen } from "./RestoreMethodScreen";
import { RestoreScreen } from "./RestoreScreen";
import { PasswordSetupScreen } from "./PasswordSetupScreen";
import { ProcessingScreen } from "./ProcessingScreen";
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
    isRestoreFlow,

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
    processingStep,
    processingTotalSteps,
    processingTitle,
    processingCompleteTitle,
    isProcessingComplete,

    // Actions
    handleCreateKeys,
    handleStartRestore,
    handleRestoreWallet,
    handleMintNametag,
    handleSkipNametag,
    handlePasswordConfirm,
    handleProcessingComplete,
    handleMnemonicBackupConfirm,
  } = useOnboardingFlow();

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 text-center relative">
      {step === "start" && (
        <StartScreen
          isBusy={isBusy}
          error={error}
          onCreateWallet={handleCreateKeys}
          onRestore={handleStartRestore}
        />
      )}

      {step === "restoreMethod" && (
        <RestoreMethodScreen
          isBusy={isBusy}
          error={error}
          onSelectMnemonic={() => setStep("restore")}
          onBack={goToStart}
        />
      )}

      {step === "restore" && (
        <RestoreScreen
          seedWords={seedWords}
          isBusy={isBusy}
          error={error}
          onSeedWordsChange={setSeedWords}
          onRestore={handleRestoreWallet}
          onBack={() => setStep("restoreMethod")}
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

      {step === "passwordSetup" && (
        <PasswordSetupScreen
          password={password}
          confirmPassword={confirmPassword}
          isBusy={isBusy}
          error={error}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onConfirm={handlePasswordConfirm}
          onBack={() => setStep(isRestoreFlow ? "restore" : "nametag")}
        />
      )}

      {step === "processing" && (
        <ProcessingScreen
          status={processingStatus}
          currentStep={processingStep}
          totalSteps={processingTotalSteps}
          title={processingTitle}
          completeTitle={processingCompleteTitle}
          isComplete={isProcessingComplete}
          onComplete={handleProcessingComplete}
        />
      )}

      {step === "mnemonicBackup" && generatedMnemonic && (
        <MnemonicBackupScreen
          mnemonic={generatedMnemonic}
          onConfirm={handleMnemonicBackupConfirm}
        />
      )}
    </div>
  );
}

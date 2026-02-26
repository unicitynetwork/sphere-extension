/**
 * useOnboardingFlow - Manages onboarding flow state and navigation
 * Matches sphere web app flow with extension-specific additions:
 * - passwordSetup step (encrypted mnemonic storage)
 * - mnemonicBackup step (show recovery phrase after create)
 *
 * Create flow:  start → nametag → passwordSetup → processing → mnemonicBackup → done
 * Restore flow: start → restoreMethod → restore → passwordSetup → processing → done
 */
import { useState, useCallback, useEffect } from "react";
import { useSphereContext } from "@/sdk/context";

export type NametagAvailability = "idle" | "checking" | "available" | "taken";

export type OnboardingStep =
  | "start"
  | "restoreMethod"
  | "restore"
  | "nametag"
  | "passwordSetup"
  | "processing"
  | "mnemonicBackup";

export function useOnboardingFlow() {
  const {
    createWallet,
    importWallet,
    isNametagAvailable,
    registerNametag,
  } = useSphereContext();

  // Step management
  const [step, setStep] = useState<OnboardingStep>("start");

  // Common state
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which flow we're in (create vs restore)
  const [isRestoreFlow, setIsRestoreFlow] = useState(false);

  // Password state (collected in passwordSetup step)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mnemonic restore state
  const [seedWords, setSeedWords] = useState<string[]>(Array(12).fill(""));

  // Generated mnemonic (from create flow)
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);

  // Nametag state (collected before wallet creation, like sphere)
  const [nametagInput, setNametagInput] = useState("");
  const [nametagAvailability, setNametagAvailability] = useState<NametagAvailability>("idle");
  const [pendingNametag, setPendingNametag] = useState<string | null>(null);

  // Processing state
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingStep, setProcessingStep] = useState(0);
  const [processingTotalSteps, setProcessingTotalSteps] = useState(3);
  const [processingTitle, setProcessingTitle] = useState("Setting up Profile...");
  const [processingCompleteTitle, setProcessingCompleteTitle] = useState("Profile Ready!");
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);

  // Debounced nametag availability check
  useEffect(() => {
    const cleanTag = nametagInput.trim().replace(/^@/, "");
    if (!cleanTag || cleanTag.length < 2) {
      setNametagAvailability("idle");
      return;
    }

    let cancelled = false;
    setNametagAvailability("checking");

    const timer = setTimeout(async () => {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (cancelled) return;
        try {
          const available = await isNametagAvailable(cleanTag);
          if (!cancelled) {
            setNametagAvailability(available ? "available" : "taken");
          }
          return;
        } catch {
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }
      if (!cancelled) {
        setNametagAvailability("idle");
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nametagInput, isNametagAvailable]);

  // Go back to start screen — reset all state
  const goToStart = useCallback(() => {
    setStep("start");
    setSeedWords(Array(12).fill(""));
    setPassword("");
    setConfirmPassword("");
    setGeneratedMnemonic(null);
    setPendingNametag(null);
    setIsRestoreFlow(false);
    setError(null);
  }, []);

  // ---- CREATE FLOW ----

  // Step 1: User clicks "Create New Wallet" → go to nametag (like sphere)
  const handleCreateKeys = useCallback(() => {
    setIsRestoreFlow(false);
    setError(null);
    setStep("nametag");
  }, []);

  // Step 2a: User enters nametag → store it, go to passwordSetup
  const handleMintNametag = useCallback(() => {
    if (!nametagInput.trim()) return;
    const cleanTag = nametagInput.trim().replace("@", "");
    setPendingNametag(cleanTag);
    setError(null);
    setStep("passwordSetup");
  }, [nametagInput]);

  // Step 2b: User skips nametag → go to passwordSetup
  const handleSkipNametag = useCallback(() => {
    setPendingNametag(null);
    setError(null);
    setStep("passwordSetup");
  }, []);

  // ---- RESTORE FLOW ----

  // Step 1: User clicks "Restore" → go to restoreMethod
  const handleStartRestore = useCallback(() => {
    setIsRestoreFlow(true);
    setError(null);
    setStep("restoreMethod");
  }, []);

  // Step 2: User validates seed words → go to passwordSetup
  const handleRestoreWallet = useCallback(() => {
    const words = seedWords.map((w) => w.trim().toLowerCase());
    const missingIndex = words.findIndex((w) => w === "");

    if (missingIndex !== -1) {
      setError(`Please fill in word ${missingIndex + 1}`);
      return;
    }

    setError(null);
    setStep("passwordSetup");
  }, [seedWords]);

  // ---- PASSWORD STEP (shared by both flows) ----

  const handlePasswordConfirm = useCallback(async () => {
    if (!password) {
      setError("Please enter a password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsBusy(true);
    setError(null);

    // Go to processing and execute wallet creation/import
    setStep("processing");
    setProcessingStep(0);
    setIsProcessingComplete(false);

    if (isRestoreFlow) {
      // RESTORE: import wallet with mnemonic + password
      setProcessingTitle("Importing Wallet...");
      setProcessingCompleteTitle("Import Complete!");
      setProcessingTotalSteps(3);
      setProcessingStatus("Importing wallet...");

      try {
        const mnemonic = seedWords.map((w) => w.trim().toLowerCase()).join(" ");
        setProcessingStep(1);
        setProcessingStatus("Restoring wallet...");

        await importWallet(mnemonic, password);

        setProcessingStep(2);
        setProcessingStatus("Setup complete!");
        setIsProcessingComplete(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Invalid recovery phrase";
        setError(message);
        setStep("restore");
      } finally {
        setIsBusy(false);
      }
    } else {
      // CREATE: create wallet with password + optional nametag
      setProcessingTotalSteps(pendingNametag ? 3 : 2);
      setProcessingTitle("Setting up Profile...");
      setProcessingCompleteTitle("Profile Ready!");
      setProcessingStatus("Creating wallet...");

      try {
        // Step 1: Create wallet
        setProcessingStep(0);
        setProcessingStatus("Creating wallet...");

        const result = await createWallet(password);
        setGeneratedMnemonic(result.mnemonic);

        // Step 2: Register nametag if provided
        if (pendingNametag) {
          setProcessingStep(1);
          setProcessingStatus("Registering Unicity ID...");

          try {
            await registerNametag(pendingNametag);
            setProcessingStep(2);
          } catch (e) {
            // Nametag registration failed but wallet was created
            console.error("Nametag registration failed:", e);
            setProcessingStep(2);
          }
        } else {
          setProcessingStep(1);
        }

        setProcessingStatus("Setup complete!");
        setIsProcessingComplete(true);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create wallet";
        setError(message);
        setStep("passwordSetup");
      } finally {
        setIsBusy(false);
      }
    }
  }, [password, confirmPassword, isRestoreFlow, seedWords, pendingNametag, createWallet, importWallet, registerNametag]);

  // ---- PROCESSING COMPLETE ----

  const handleProcessingComplete = useCallback(() => {
    if (isRestoreFlow) {
      // Restore flow: done, reload
      window.location.reload();
    } else {
      // Create flow: show mnemonic backup
      setStep("mnemonicBackup");
    }
  }, [isRestoreFlow]);

  // ---- MNEMONIC BACKUP ----

  const handleMnemonicBackupConfirm = useCallback(() => {
    // Done — reload to show main wallet UI
    window.location.reload();
  }, []);

  return {
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
  };
}

/**
 * useOnboardingFlow - Manages onboarding flow state and navigation
 * Extension-specific: requires password for wallet creation/import (encrypted storage)
 * Simplified from sphere web app: no file import, no address selection, no IPNS
 */
import { useState, useCallback, useEffect } from "react";
import { useSphereContext } from "@/sdk/context";

export type NametagAvailability = "idle" | "checking" | "available" | "taken";

export type OnboardingStep =
  | "start"
  | "restore"
  | "mnemonicBackup"
  | "nametag"
  | "processing";

export interface UseOnboardingFlowReturn {
  // Step management
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  goToStart: () => void;

  // State
  isBusy: boolean;
  error: string | null;

  // Password state (extension-specific)
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;

  // Mnemonic restore state
  seedWords: string[];
  setSeedWords: (words: string[]) => void;

  // Generated mnemonic (from create flow)
  generatedMnemonic: string | null;

  // Nametag state
  nametagInput: string;
  setNametagInput: (value: string) => void;
  nametagAvailability: NametagAvailability;

  // Processing state
  processingStatus: string;
  processingStep: number;
  processingTotalSteps: number;
  processingTitle: string;
  processingCompleteTitle: string;
  isProcessingComplete: boolean;

  // Actions
  handleCreateWallet: () => Promise<void>;
  handleRestoreWallet: () => Promise<void>;
  handleMnemonicBackupConfirm: () => void;
  handleMintNametag: () => Promise<void>;
  handleSkipNametag: () => void;
  handleCompleteOnboarding: () => void;
}

export function useOnboardingFlow(): UseOnboardingFlowReturn {
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

  // Password state (extension-specific: encrypted mnemonic storage)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mnemonic restore state
  const [seedWords, setSeedWords] = useState<string[]>(Array(12).fill(""));

  // Generated mnemonic (from create flow)
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);

  // Nametag state
  const [nametagInput, setNametagInput] = useState("");
  const [nametagAvailability, setNametagAvailability] = useState<NametagAvailability>("idle");

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
      // All attempts failed
      if (!cancelled) {
        setNametagAvailability("idle");
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [nametagInput, isNametagAvailable]);

  // Go back to start screen
  const goToStart = useCallback(() => {
    setStep("start");
    setSeedWords(Array(12).fill(""));
    setPassword("");
    setConfirmPassword("");
    setGeneratedMnemonic(null);
    setError(null);
  }, []);

  // Action: Create wallet with password
  const handleCreateWallet = useCallback(async () => {
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

    try {
      const result = await createWallet(password);
      setGeneratedMnemonic(result.mnemonic);
      setStep("mnemonicBackup");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create wallet";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [password, confirmPassword, createWallet]);

  // Action: Confirm mnemonic backup and proceed to nametag
  const handleMnemonicBackupConfirm = useCallback(() => {
    setStep("nametag");
  }, []);

  // Action: Restore wallet from mnemonic + password
  const handleRestoreWallet = useCallback(async () => {
    const words = seedWords.map((w) => w.trim().toLowerCase());
    const missingIndex = words.findIndex((w) => w === "");

    if (missingIndex !== -1) {
      setError(`Please fill in word ${missingIndex + 1}`);
      return;
    }

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

    try {
      const mnemonic = words.join(" ");
      await importWallet(mnemonic, password);
      setStep("nametag");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid recovery phrase";
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }, [seedWords, password, confirmPassword, importWallet]);

  // Action: Register nametag
  const handleMintNametag = useCallback(async () => {
    if (!nametagInput.trim()) return;

    setIsBusy(true);
    setError(null);

    const cleanTag = nametagInput.trim().replace("@", "");

    setStep("processing");
    setProcessingTitle("Setting up Profile...");
    setProcessingCompleteTitle("Profile Ready!");
    setProcessingStep(0);
    setProcessingTotalSteps(3);
    setProcessingStatus("Checking Unicity ID availability...");
    setIsProcessingComplete(false);

    try {
      // Step 1: Check availability
      const available = await isNametagAvailable(cleanTag);
      if (!available) {
        setError(`@${cleanTag} is already taken`);
        setStep("nametag");
        setIsBusy(false);
        return;
      }

      setProcessingStep(1);
      setProcessingStatus("Registering Unicity ID...");

      // Step 2: Register nametag
      await registerNametag(cleanTag);

      setProcessingStep(2);
      setProcessingStatus("Setup complete!");
      setIsProcessingComplete(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to register Unicity ID";
      console.error("Nametag registration failed:", e);
      setError(message);
      setStep("nametag");
    } finally {
      setIsBusy(false);
    }
  }, [nametagInput, isNametagAvailable, registerNametag]);

  // Action: Skip nametag
  const handleSkipNametag = useCallback(() => {
    setStep("processing");
    setProcessingTitle("Setting up Profile...");
    setProcessingCompleteTitle("Profile Ready!");
    setProcessingTotalSteps(1);
    setProcessingStep(1);
    setProcessingStatus("Setup complete!");
    setIsProcessingComplete(true);
  }, []);

  // Action: Complete onboarding
  const handleCompleteOnboarding = useCallback(() => {
    // Reload to let the app detect the wallet and show the main UI
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
    handleCreateWallet,
    handleRestoreWallet,
    handleMnemonicBackupConfirm,
    handleMintNametag,
    handleSkipNametag,
    handleCompleteOnboarding,
  };
}

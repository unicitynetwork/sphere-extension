import { useSphereContext } from '../context';

export function useWalletStatus() {
  const { walletExists, isLoading, error, isUnlocked } = useSphereContext();
  return { walletExists, isLoading, isUnlocked, error };
}

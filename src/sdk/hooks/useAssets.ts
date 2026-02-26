import { useQuery } from '@tanstack/react-query';
import { useSphereContext } from '../context';
import { SPHERE_KEYS } from '../queryKeys';

export function useAssets() {
  const { getAssets, isUnlocked } = useSphereContext();

  const { data: assets = [], isLoading, error, refetch } = useQuery({
    queryKey: SPHERE_KEYS.payments.assets.list,
    queryFn: getAssets,
    enabled: isUnlocked,
    staleTime: 30_000,
  });

  return {
    assets,
    isLoading,
    error,
    assetCount: assets.length,
    refetch,
  };
}

import { useQuery } from '@tanstack/react-query';
import { useSphereContext } from '../context';
import { SPHERE_KEYS } from '../queryKeys';

export function useTokens() {
  const { getTokens, isUnlocked } = useSphereContext();

  const { data: tokens = [], isLoading, error, refetch } = useQuery({
    queryKey: SPHERE_KEYS.payments.tokens.list,
    queryFn: getTokens,
    enabled: isUnlocked,
    staleTime: 30_000,
    structuralSharing: false,
  });

  const confirmedTokens = tokens.filter((t: any) => t.status === 'confirmed');
  const pendingTokens = tokens.filter((t: any) => t.status === 'pending' || t.status === 'submitted');

  return {
    tokens,
    isLoading,
    error,
    refetch,
    tokenCount: tokens.length,
    hasTokens: tokens.length > 0,
    confirmedTokens,
    pendingTokens,
  };
}

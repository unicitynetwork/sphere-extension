import { useQuery } from '@tanstack/react-query';
import { useSphereContext } from '../context';
import { SPHERE_KEYS } from '../queryKeys';

export function useTransactionHistory() {
  const { getTransactionHistory, isUnlocked } = useSphereContext();

  const { data: history = [], isLoading, error, refetch } = useQuery({
    queryKey: SPHERE_KEYS.payments.transactions.history,
    queryFn: getTransactionHistory,
    enabled: isUnlocked,
    staleTime: 30_000,
  });

  return { history, isLoading, error, refetch };
}

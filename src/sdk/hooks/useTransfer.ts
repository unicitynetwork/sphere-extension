import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSphereContext } from '../context';
import { SPHERE_KEYS } from '../queryKeys';

export interface TransferParams {
  coinId: string;
  amount: string;
  recipient: string;
  memo?: string;
}

export function useTransfer() {
  const { send } = useSphereContext();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const transfer = async (params: TransferParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await send(params);
      // Refetch all payment-related queries
      await queryClient.refetchQueries({ queryKey: SPHERE_KEYS.payments.tokens.list });
      await queryClient.refetchQueries({ queryKey: SPHERE_KEYS.payments.assets.list });
      await queryClient.refetchQueries({ queryKey: SPHERE_KEYS.payments.transactions.history });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { transfer, isLoading, error };
}

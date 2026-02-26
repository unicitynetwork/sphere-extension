import { useQuery } from '@tanstack/react-query';
import { useSphereContext } from '../context';
import { SPHERE_KEYS } from '../queryKeys';

export function useIdentity() {
  const { getIdentity, isUnlocked, identity, nametag } = useSphereContext();

  const { data, isLoading } = useQuery({
    queryKey: SPHERE_KEYS.identity.current,
    queryFn: getIdentity,
    enabled: isUnlocked,
    staleTime: Infinity,
  });

  const resolved = data ?? identity;
  const directAddress = resolved?.directAddress ?? null;
  const l1Address = resolved?.l1Address ?? null;
  const resolvedNametag = resolved?.nametag ?? nametag;

  const displayName = resolvedNametag ? `@${resolvedNametag}` : (directAddress ? `${directAddress.slice(0, 12)}...` : 'Unknown');
  const shortAddress = directAddress ? `${directAddress.slice(0, 12)}...${directAddress.slice(-6)}` : '';

  return {
    identity: resolved,
    isLoading,
    nametag: resolvedNametag,
    directAddress,
    l1Address,
    displayName,
    shortAddress,
  };
}

export const SPHERE_KEYS = {
  all: ['sphere'] as const,
  payments: {
    all: ['sphere', 'payments'] as const,
    assets: {
      all: ['sphere', 'payments', 'assets'] as const,
      list: ['sphere', 'payments', 'assets', 'list'] as const,
    },
    tokens: {
      all: ['sphere', 'payments', 'tokens'] as const,
      list: ['sphere', 'payments', 'tokens', 'list'] as const,
    },
    balance: {
      all: ['sphere', 'payments', 'balance'] as const,
      byCoin: (coinId: string) => ['sphere', 'payments', 'balance', coinId] as const,
    },
    transactions: {
      all: ['sphere', 'payments', 'transactions'] as const,
      history: ['sphere', 'payments', 'transactions', 'history'] as const,
    },
  },
  identity: {
    all: ['sphere', 'identity'] as const,
    current: ['sphere', 'identity', 'current'] as const,
  },
  l1: {
    all: ['sphere', 'l1'] as const,
    balance: ['sphere', 'l1', 'balance'] as const,
  },
} as const;

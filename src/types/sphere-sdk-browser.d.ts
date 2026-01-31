declare module '@unicitylabs/sphere-sdk/impl/browser' {
  export function createLocalStorageProvider(config?: {
    prefix?: string;
    debug?: boolean;
  }): import('@unicitylabs/sphere-sdk').StorageProvider;

  export function createIndexedDBTokenStorageProvider(config?: {
    dbName?: string;
    debug?: boolean;
  }): import('@unicitylabs/sphere-sdk').TokenStorageProvider<import('@unicitylabs/sphere-sdk').TxfStorageDataBase>;

  export function createNostrTransportProvider(config?: {
    relays?: string[];
    debug?: boolean;
  }): import('@unicitylabs/sphere-sdk').TransportProvider;

  export function createUnicityAggregatorProvider(config?: {
    url?: string;
    apiKey?: string;
    skipVerification?: boolean;
    trustBaseUrl?: string;
    debug?: boolean;
  }): import('@unicitylabs/sphere-sdk').OracleProvider;
}

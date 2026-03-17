export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  disconnect?: () => Promise<void> | void;
};

let activeEip1193Provider: Eip1193Provider | null = null;
let walletConnectProvider: Eip1193Provider | null = null;

export function getActiveEip1193Provider(): Eip1193Provider | null {
  return activeEip1193Provider;
}

export function setActiveEip1193Provider(provider: Eip1193Provider | null): void {
  activeEip1193Provider = provider;
}

export function getWalletConnectProvider(): Eip1193Provider | null {
  return walletConnectProvider;
}

export function setWalletConnectProvider(provider: Eip1193Provider | null): void {
  walletConnectProvider = provider;
}

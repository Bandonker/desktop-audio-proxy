export interface ProxyClientWithStop {
  stopProxyServer(): Promise<void>;
}

export interface DeferredProxyStopController {
  cancel(client: ProxyClientWithStop): void;
  schedule(client: ProxyClientWithStop): void;
}

/**
 * Defers destructive client cleanup by one task so React development-mode
 * effect replay can retain the same memoized client before it is stopped.
 */
export function createDeferredProxyStopController(): DeferredProxyStopController {
  const pendingStops = new Map<
    ProxyClientWithStop,
    ReturnType<typeof setTimeout>
  >();

  return {
    cancel(client) {
      const pendingStop = pendingStops.get(client);
      if (pendingStop === undefined) return;

      clearTimeout(pendingStop);
      pendingStops.delete(client);
    },

    schedule(client) {
      if (pendingStops.has(client)) return;

      const pendingStop = setTimeout(() => {
        pendingStops.delete(client);
        void client.stopProxyServer();
      }, 0);
      pendingStops.set(client, pendingStop);
    },
  };
}

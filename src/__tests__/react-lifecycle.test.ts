import { createDeferredProxyStopController } from '../react-lifecycle';

describe('React proxy client lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps the client alive across development effect replay', () => {
    const client = {
      stopProxyServer: jest.fn().mockResolvedValue(undefined),
    };
    const stopController = createDeferredProxyStopController();

    stopController.cancel(client);
    stopController.schedule(client);
    stopController.cancel(client);
    jest.runOnlyPendingTimers();

    expect(client.stopProxyServer).not.toHaveBeenCalled();

    stopController.schedule(client);
    jest.runOnlyPendingTimers();

    expect(client.stopProxyServer).toHaveBeenCalledTimes(1);
  });

  it('still stops a replaced client while retaining its replacement', () => {
    const previousClient = {
      stopProxyServer: jest.fn().mockResolvedValue(undefined),
    };
    const replacementClient = {
      stopProxyServer: jest.fn().mockResolvedValue(undefined),
    };
    const stopController = createDeferredProxyStopController();

    stopController.cancel(previousClient);
    stopController.schedule(previousClient);
    stopController.cancel(replacementClient);
    jest.runOnlyPendingTimers();

    expect(previousClient.stopProxyServer).toHaveBeenCalledTimes(1);
    expect(replacementClient.stopProxyServer).not.toHaveBeenCalled();
  });
});

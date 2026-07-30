import { AudioProxyDebugger } from '../debugger';
import { TelemetryManager } from '../telemetry';

describe('observability isolation', () => {
  it('does not let a telemetry callback failure escape into application code', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const telemetry = new TelemetryManager({
      enabled: true,
      onEvent: () => {
        throw new Error('observer failed');
      },
    });

    expect(() => telemetry.trackEvent('proxy_check')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      '[AudioProxyTelemetry] Event callback failed'
    );
    warnSpy.mockRestore();
  });

  it('tracks a performance mark created at timestamp zero', () => {
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(25)
      .mockReturnValueOnce(25);
    const events: unknown[] = [];
    const telemetry = new TelemetryManager({
      enabled: true,
      onEvent: event => events.push(event),
    });

    telemetry.startPerformanceTracking('startup');

    expect(telemetry.endPerformanceTracking('startup')).toBe(25);
    expect(events).toHaveLength(1);
    nowSpy.mockRestore();
  });

  it('does not let a debugger callback failure escape or expose its log array', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    const debug = new AudioProxyDebugger({
      enabled: true,
      onLog: entry => {
        entry.message = 'observer mutation';
        throw new Error('observer failed');
      },
    });

    expect(() => debug.info('client', 'message')).not.toThrow();
    const logs = debug.getLogs();
    logs[0].message = 'consumer mutation';
    logs.length = 0;

    expect(debug.getLogs()).toHaveLength(1);
    expect(debug.getLogs()[0].message).toBe('message');
    expect(warnSpy).toHaveBeenCalledWith(
      '[AudioProxyDebugger] Log callback failed'
    );
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});

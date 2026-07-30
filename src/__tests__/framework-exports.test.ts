import { App, nextTick, ref } from 'vue';
import {
  audioProxyInjectionKey,
  createAudioProxy,
  useAudioProxy,
} from '../vue';
import { AudioProxyClient } from '../client';
import { StreamInfo } from '../types';

describe('framework integration contracts', () => {
  it('provides the Vue client under the exported injection key', () => {
    const provided = new Map<unknown, unknown>();
    const fakeApp = {
      config: { globalProperties: {} },
      provide(key: unknown, value: unknown) {
        provided.set(key, value);
        return this;
      },
    } as unknown as App;

    createAudioProxy().install(fakeApp);

    expect(provided.get(audioProxyInjectionKey)).toBeInstanceOf(
      AudioProxyClient
    );
  });

  it('ignores stale Vue URL results that complete out of order', async () => {
    let resolveOldInfo: ((value: StreamInfo) => void) | undefined;
    const oldInfo = new Promise<StreamInfo>(resolve => {
      resolveOldInfo = resolve;
    });
    const newInfo: StreamInfo = {
      url: 'https://example.com/new.mp3',
      status: 200,
      headers: {},
      canPlay: true,
      requiresProxy: true,
    };

    const canPlaySpy = jest
      .spyOn(AudioProxyClient.prototype, 'canPlayUrl')
      .mockImplementation(url =>
        url.includes('/old.mp3') ? oldInfo : Promise.resolve(newInfo)
      );
    const playableSpy = jest
      .spyOn(AudioProxyClient.prototype, 'getPlayableUrl')
      .mockImplementation(url => Promise.resolve(`playable:${url}`));

    try {
      const source = ref<string | null>('https://example.com/old.mp3');
      const result = useAudioProxy(source);

      source.value = 'https://example.com/new.mp3';
      await nextTick();
      await Promise.resolve();
      await Promise.resolve();

      expect(result.audioUrl.value).toBe(
        'playable:https://example.com/new.mp3'
      );

      resolveOldInfo?.({
        ...newInfo,
        url: 'https://example.com/old.mp3',
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(result.audioUrl.value).toBe(
        'playable:https://example.com/new.mp3'
      );
      expect(playableSpy).not.toHaveBeenCalledWith(
        'https://example.com/old.mp3'
      );
    } finally {
      canPlaySpy.mockRestore();
      playableSpy.mockRestore();
    }
  });
});

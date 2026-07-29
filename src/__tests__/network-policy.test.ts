import { LookupAddress } from 'dns';
import { LookupFunction } from 'net';
import {
  AudioProxyServer,
  createSafeLookup,
  isPublicAddress,
  rewriteHlsPlaylist,
} from '../server-impl';
import * as serverImplementation from '../server-impl';

const isHostAllowed = (
  serverImplementation as unknown as {
    isHostAllowed: (hostname: string, allowedHosts: string[]) => boolean;
  }
).isHostAllowed;

type FakeResolver = (
  hostname: string,
  options: { all: true; verbatim: true },
  callback: (
    error: NodeJS.ErrnoException | null,
    addresses: LookupAddress[]
  ) => void
) => void;

function runLookup(
  lookup: LookupFunction,
  hostname: string,
  all = false
): Promise<string | LookupAddress[]> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { all }, (error, address) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(address);
    });
  });
}

describe('proxy network policy', () => {
  it.each([
    ['stream.example.com', ['stream.example.com'], true],
    ['STREAM.EXAMPLE.COM.', ['stream.example.com'], true],
    ['edge.radio.example.com', ['*.radio.example.com'], true],
    ['radio.example.com', ['*.radio.example.com'], false],
    ['evilradio.example.com', ['*.radio.example.com'], false],
    ['stream.attacker.example', ['stream.example.com'], false],
    ['2606:4700:4700::1111', ['[2606:4700:4700::1111]'], true],
  ] as Array<[string, string[], boolean]>)(
    'evaluates host allowlist boundaries for %s',
    (hostname, allowedHosts, expected) => {
      expect(isHostAllowed(hostname, allowedHosts)).toBe(expected);
    }
  );

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '[::1]',
    '::ffff:7f00:1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '3fff::1',
  ])('classifies %s as non-public', address => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'classifies %s as public',
    address => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it('rejects a hostname when DNS resolves to a private address', async () => {
    const resolver: FakeResolver = (_hostname, _options, callback) => {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    };
    const lookup = createSafeLookup(resolver);

    await expect(runLookup(lookup, 'media.example')).rejects.toMatchObject({
      code: 'EPRIVATEADDRESS',
    });
  });

  it('rejects mixed public and private DNS results', async () => {
    const resolver: FakeResolver = (_hostname, _options, callback) => {
      callback(null, [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]);
    };
    const lookup = createSafeLookup(resolver);

    await expect(runLookup(lookup, 'media.example')).rejects.toMatchObject({
      code: 'EPRIVATEADDRESS',
    });
  });

  it('returns public DNS results in the shape requested by Node', async () => {
    const resolver: FakeResolver = (_hostname, _options, callback) => {
      callback(null, [
        { address: '8.8.8.8', family: 4 },
        { address: '1.1.1.1', family: 4 },
      ]);
    };
    const lookup = createSafeLookup(resolver);

    await expect(runLookup(lookup, 'media.example')).resolves.toBe('8.8.8.8');
    await expect(runLookup(lookup, 'media.example', true)).resolves.toEqual([
      { address: '8.8.8.8', family: 4 },
      { address: '1.1.1.1', family: 4 },
    ]);
  });

  it('rejects redirects to non-public literal addresses', () => {
    const server = new AudioProxyServer({ enableLogging: false });
    const secureOptions = (
      server as unknown as {
        getSecureNetworkOptions(): {
          proxy?: false;
          beforeRedirect?: (options: {
            protocol: string;
            hostname: string;
          }) => void;
        };
      }
    ).getSecureNetworkOptions();

    expect(secureOptions.proxy).toBe(false);
    expect(() =>
      secureOptions.beforeRedirect?.({
        protocol: 'http:',
        hostname: '127.0.0.1',
      })
    ).toThrow('private or non-public');
  });

  it('applies the station host allowlist to redirects', () => {
    const server = new AudioProxyServer({
      allowPrivateAddresses: true,
      allowedHosts: ['radio.example', '*.trusted-cdn.example'],
      enableLogging: false,
    });
    const secureOptions = (
      server as unknown as {
        getSecureNetworkOptions(): {
          beforeRedirect?: (options: {
            protocol: string;
            hostname: string;
          }) => void;
        };
      }
    ).getSecureNetworkOptions();

    expect(() =>
      secureOptions.beforeRedirect?.({
        protocol: 'https:',
        hostname: 'media.attacker.example',
      })
    ).toThrow('not allowed');
    expect(() =>
      secureOptions.beforeRedirect?.({
        protocol: 'https:',
        hostname: 'edge.trusted-cdn.example',
      })
    ).not.toThrow();
  });

  it('rewrites HLS segments, variants, and key URIs through the proxy', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="../keys/key.bin"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
      'variants/high.m3u8',
      'https://cdn.example/segments/one.ts?token=abc',
      'https://user:secret@media.example/private/two.ts',
    ].join('\n');

    const rewritten = rewriteHlsPlaylist(
      playlist,
      'https://media.example/live/master/index.m3u8'
    );

    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://media.example/live/keys/key.bin'
      )}`
    );
    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://media.example/live/master/variants/high.m3u8'
      )}`
    );
    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://cdn.example/segments/one.ts?token=abc'
      )}`
    );
    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://user:secret@media.example/private/two.ts'
      )}`
    );
  });

  it('preserves HLS variable references in rewritten playlist URIs', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-DEFINE:NAME="auth",VALUE="signed-query"',
      '#EXT-X-DEFINE:IMPORT="rendition"',
      '#EXT-X-KEY:METHOD=AES-128,URI="../keys/key.bin?token={$auth}"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1280000',
      'variants/{$rendition}.m3u8?token={$auth}',
      'segments/one.ts?token={$auth}',
    ].join('\n');

    const rewritten = rewriteHlsPlaylist(
      playlist,
      'https://media.example/live/master/index.m3u8'
    );

    expect(rewritten).toContain(
      `URI="/proxy?url=${encodeURIComponent(
        'https://media.example/live/keys/key.bin?token=signed-query'
      )}"`
    );
    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://media.example/live/master/variants/'
      )}{$rendition}${encodeURIComponent('.m3u8?token=signed-query')}`
    );
    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent(
        'https://media.example/live/master/segments/one.ts?token=signed-query'
      )}`
    );
  });

  it('expands an HLS variable with an absolute URL before base resolution', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-DEFINE:NAME="cdn",VALUE="https://cdn.example"',
      '#EXT-X-DEFINE:IMPORT="parentCdn"',
      '#EXTINF:5,',
      '{$cdn}/segments/one.ts',
      '#EXTINF:5,',
      '{$parentCdn}/segments/two.ts',
    ].join('\n');

    const rewritten = rewriteHlsPlaylist(
      playlist,
      'https://manifest.example/live/index.m3u8'
    );

    expect(rewritten).toContain(
      `/proxy?url=${encodeURIComponent('https://cdn.example/segments/one.ts')}`
    );
    expect(rewritten).not.toContain(
      encodeURIComponent('https://manifest.example/live/{$cdn}/segments/one.ts')
    );
    expect(rewritten).toContain(
      `\n/proxy?base=${encodeURIComponent(
        'https://manifest.example/live/index.m3u8'
      )}&reference={$parentCdn}${encodeURIComponent('/segments/two.ts')}`
    );
  });
});

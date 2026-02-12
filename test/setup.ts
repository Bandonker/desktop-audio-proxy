// Jest setup file
// Add any global test setup here

type TestWindowLocation = {
  hostname: string;
  protocol: string;
  port: string;
};

type TestGlobal = {
  window: {
    location: TestWindowLocation;
  };
  process: {
    versions?: Record<string, string>;
    cwd?: () => string;
    uptime?: () => number;
  };
};

const testGlobal = globalThis as unknown as TestGlobal;

// Mock browser globals for testing
testGlobal.window = {
  location: {
    hostname: 'localhost',
    protocol: 'http:',
    port: '3000',
  },
};

// Mock process for testing - preserve existing process functions
if (typeof process === 'undefined') {
  testGlobal.process = {
    versions: {},
    cwd: () => '/',
    uptime: () => 0,
  };
} else {
  // Keep existing process but ensure versions exists
  if (!process.versions) {
    Object.defineProperty(process, 'versions', {
      value: {},
      configurable: true,
    });
  }
}

// Create a properly typed fetch mock
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock Audio constructor
global.Audio = jest.fn().mockImplementation(() => ({
  canPlayType: jest.fn().mockReturnValue('probably'),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  src: '',
  currentTime: 0,
  duration: 0,
  paused: true,
  ended: false,
}));

const suppressConsoleOutput = () => undefined;

// Only reset mock call history, not implementations
beforeEach(() => {
  // Clear call history but preserve implementations set by individual tests
  mockFetch.mockClear();
  // Reset Audio mock calls
  (global.Audio as jest.Mock).mockClear();

  // Keep test output quiet while preserving call assertions.
  jest.spyOn(console, 'log').mockImplementation(suppressConsoleOutput);
  jest.spyOn(console, 'warn').mockImplementation(suppressConsoleOutput);
  jest.spyOn(console, 'error').mockImplementation(suppressConsoleOutput);
});

afterEach(() => {
  jest.restoreAllMocks();
});

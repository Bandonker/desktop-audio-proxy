// Jest setup file
// Add any global test setup here

// Mock browser globals for testing
(global as any).window = {
  location: {
    hostname: 'localhost',
    protocol: 'http:',
    port: '3000'
  }
};

// Mock process for testing - preserve existing process functions
if (typeof process === 'undefined') {
  (global as any).process = {
    versions: {},
    cwd: () => '/',
    uptime: () => 0,
  };
} else {
  // Keep existing process but ensure versions exists
  if (!process.versions) {
    (process as any).versions = {};
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
  ended: false
}));

// Only reset mock call history, not implementations
beforeEach(() => {
  // Clear call history but preserve implementations set by individual tests
  mockFetch.mockClear();
  // Reset Audio mock calls
  (global.Audio as jest.Mock).mockClear();
});
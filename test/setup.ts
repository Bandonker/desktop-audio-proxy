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

// Mock process for testing
(global as any).process = {
  versions: {}
};

// Mock fetch for testing
global.fetch = jest.fn();

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

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
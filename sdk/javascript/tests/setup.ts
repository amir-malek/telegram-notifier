import axios from 'axios';

// Mock axios for tests
jest.mock('axios');
export const mockedAxios = axios as jest.Mocked<typeof axios>;

// Setup common test configuration
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();

  // Setup default axios mock
  mockedAxios.create.mockReturnValue(mockedAxios);
});
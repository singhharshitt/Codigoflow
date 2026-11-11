import { getAIStatus } from '../../integrations/ai';

// Isolate from real env
const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  // Clear the module cache to reset singleton client
  jest.resetModules();
});

describe('getAIStatus', () => {
  it('reports not configured when AI_API_KEY is absent', () => {
    delete process.env.AI_API_KEY;
    const status = getAIStatus();
    expect(status.configured).toBe(false);
  });

  it('does not expose the API key in the response', () => {
    process.env.AI_API_KEY = 'super-secret-key';
    const status = getAIStatus();
    expect(JSON.stringify(status)).not.toContain('super-secret-key');
  });

  it('returns model and baseUrl', () => {
    const status = getAIStatus();
    expect(typeof status.model).toBe('string');
    expect(typeof status.baseUrl).toBe('string');
  });
});

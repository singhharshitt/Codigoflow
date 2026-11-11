import { getAIStatus, stripSecrets } from '../../integrations/ai';
import { resetNvidiaClient } from '../../integrations/ai/nvidia/client';

describe('getAIStatus', () => {
  afterEach(() => {
    resetNvidiaClient();
  });

  it('does not expose the API key in the response', () => {
    const status = getAIStatus();
    expect(JSON.stringify(status)).not.toMatch(/sk-|nvapi-/i);
    expect(status).not.toHaveProperty('apiKey');
    expect(typeof status.model).toBe('string');
    expect(typeof status.baseUrl).toBe('string');
    expect(typeof status.configured).toBe('boolean');
  });

  it('returns provider label', () => {
    const status = getAIStatus();
    expect(['none', 'nvidia', 'openai-compatible']).toContain(status.provider);
  });
});

describe('stripSecrets', () => {
  it('redacts bearer tokens and api keys', () => {
    const cleaned = stripSecrets('Authorization: Bearer abc.def.ghi api_key=sk-secretvalue123');
    expect(cleaned).not.toContain('abc.def.ghi');
    expect(cleaned).not.toContain('sk-secretvalue123');
    expect(cleaned).toContain('[redacted]');
  });
});

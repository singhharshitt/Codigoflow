describe('AI key priority resolution', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function loadConfig() {
    // Force re-import after env mutation
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./env') as typeof import('./env');
  }

  it('prefers LLM_API_KEY over AI_API_KEY and uses LLM_API_KEY2 as secondary', () => {
    process.env.NVIDIA_API_KEY = '';
    process.env.LLM_API_KEY = 'primary-llm-key-value';
    process.env.AI_API_KEY = 'legacy-ai-key-value';
    process.env.LLM_API_KEY2 = 'secondary-llm-key-value';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    process.env.AI_MODEL = 'gpt-4o-mini';

    const { config, isAIConfigured, getConfiguredAiKeyCount } = loadConfig();
    expect(isAIConfigured()).toBe(true);
    expect(config.AI_API_KEY).toBe('primary-llm-key-value');
    expect(config.AI_API_KEYS).toEqual([
      'primary-llm-key-value',
      'legacy-ai-key-value',
      'secondary-llm-key-value',
    ]);
    expect(getConfiguredAiKeyCount()).toBe(3);
  });

  it('deduplicates identical keys', () => {
    process.env.NVIDIA_API_KEY = '';
    process.env.LLM_API_KEY = 'same-key';
    process.env.LLM_API_KEY2 = 'same-key';
    process.env.AI_API_KEY = '';

    const { config, getConfiguredAiKeyCount } = loadConfig();
    expect(config.AI_API_KEYS).toEqual(['same-key']);
    expect(getConfiguredAiKeyCount()).toBe(1);
  });
});

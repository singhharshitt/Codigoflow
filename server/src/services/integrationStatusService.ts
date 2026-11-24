import { STATUS_CACHE_TTL_MS } from '../config';
import { getGitVersion } from '../integrations/git';
import { getDockerStatus } from '../integrations/docker';
import { getGitHubStatus } from '../integrations/github';
import { getAIStatus } from '../integrations/ai';
import {
  terraformAdapter,
  ansibleAdapter,
  puppetAdapter,
  nagiosAdapter,
} from '../integrations/infrastructure';

interface CacheEntry {
  at: number;
  value: unknown;
}

let cache: CacheEntry | null = null;

export async function getIntegrationsStatus(force = false) {
  if (!force && cache && Date.now() - cache.at < STATUS_CACHE_TTL_MS) {
    return cache.value;
  }

  const [git, docker, terraform, ansible, puppet, nagios] = await Promise.all([
    getGitVersion(),
    getDockerStatus(),
    terraformAdapter.checkAvailability(),
    ansibleAdapter.checkAvailability(),
    puppetAdapter.checkAvailability(),
    nagiosAdapter.checkAvailability(),
  ]);

  const github = getGitHubStatus();
  const ai = getAIStatus();

  const value = {
    git: {
      state: git.available ? 'connected' : 'unavailable',
      available: git.available,
      version: git.version,
    },
    github: {
      state: github.configured ? 'connected' : 'not_configured',
      configured: github.configured,
      note: github.note,
    },
    docker: {
      state: docker.available ? 'connected' : 'unavailable',
      available: docker.available,
      version: docker.version,
      error: docker.error,
    },
    ai: {
      state: ai.configured ? 'connected' : 'not_configured',
      configured: ai.configured,
      provider: ai.provider,
      defaultProvider: ai.defaultProvider,
      providers: ai.providers.map((p) => ({ id: p.id, label: p.label, model: p.model })),
      model: ai.model,
      baseUrl: ai.baseUrl,
      // Never include API keys
    },
    terraform: {
      state: terraform.state,
      available: terraform.available,
      version: terraform.version,
      error: terraform.error,
    },
    ansible: {
      state: ansible.state,
      available: ansible.available,
      version: ansible.version,
      error: ansible.error,
    },
    puppet: {
      state: puppet.state,
      available: puppet.available,
      version: puppet.version,
      error: puppet.error,
    },
    nagios: {
      state: nagios.state,
      available: nagios.available,
      error: nagios.error,
    },
    meta: {
      aiKeyPresent: ai.configured,
      model: ai.model,
      cached: false,
    },
  };

  cache = { at: Date.now(), value: { ...value, meta: { ...value.meta, cached: false } } };
  return value;
}

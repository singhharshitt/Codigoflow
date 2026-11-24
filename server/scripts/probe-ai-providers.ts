/**
 * Minimal real-provider probe: lists configured providers (no secrets) and sends
 * ONE tiny request to each. Billable usage is a handful of tokens per provider.
 *
 *   npx tsx scripts/probe-ai-providers.ts            # all providers
 *   npx tsx scripts/probe-ai-providers.ts gemini     # one provider
 */
import '../src/config/env';
import { listProviders, testProvider, toPublic } from '../src/integrations/ai/providers';

async function main() {
  const only = process.argv[2];
  const providers = listProviders().filter((p) => !only || p.id === only);
  if (providers.length === 0) {
    console.log('No AI providers configured');
    process.exitCode = 1;
    return;
  }
  for (const p of providers) {
    const pub = toPublic(p);
    console.log(`\n[${pub.id}] ${pub.label} · model=${pub.model} · base=${pub.baseUrl} · keys=${pub.keyCount} · timeout=${pub.timeoutMs}ms`);
    const result = await testProvider(p.id);
    console.log(result.ok ? `  PASS ${result.latencyMs}ms · ${result.message}` : `  FAIL ${result.code} · ${result.message}`);
  }
}

void main();

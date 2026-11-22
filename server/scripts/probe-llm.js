/**
 * Live LLM probe — tests each configured server key independently.
 * Usage (Git Bash / npm):
 *   node --experimental-sqlite scripts/probe-llm.js
 * Never prints secret values.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OpenAI = require('openai').default;

function uniq(keys) {
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    const v = (k || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

const baseURL = (
  process.env.NVIDIA_BASE_URL ||
  process.env.LLM_BASE_URL ||
  process.env.AI_BASE_URL ||
  'https://integrate.api.nvidia.com/v1'
).replace(/\/$/, '');

const model =
  process.env.NVIDIA_MODEL ||
  process.env.LLM_MODEL ||
  process.env.AI_MODEL ||
  'qwen/qwen2.5-coder-32b-instruct';

const slots = [
  { name: 'NVIDIA_API_KEY', value: process.env.NVIDIA_API_KEY },
  { name: 'LLM_API_KEY', value: process.env.LLM_API_KEY },
  { name: 'AI_API_KEY', value: process.env.AI_API_KEY },
  { name: 'LLM_API_KEY2', value: process.env.LLM_API_KEY2 },
];

async function probeOne(label, apiKey) {
  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 45_000,
    maxRetries: 0,
  });
  const started = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 8,
      temperature: 0,
    });
    const text = (completion.choices[0]?.message?.content || '').trim();
    return {
      label,
      ok: true,
      ms: Date.now() - started,
      preview: text.slice(0, 40),
      keyLen: apiKey.length,
    };
  } catch (err) {
    return {
      label,
      ok: false,
      ms: Date.now() - started,
      keyLen: apiKey.length,
      status: err.status || err.code || 'error',
      message: String(err.message || err)
        .replace(/sk-[A-Za-z0-9]+/g, '[redacted]')
        .replace(/nvapi-[A-Za-z0-9_-]+/g, '[redacted]')
        .slice(0, 200),
    };
  }
}

async function main() {
  console.log('=== CódigoFlow LLM probe ===');
  console.log(`baseURL=${baseURL}`);
  console.log(`model=${model}`);

  const present = slots.filter((s) => (s.value || '').trim());
  const missing = slots.filter((s) => !(s.value || '').trim()).map((s) => s.name);

  console.log(`configured_slots=${present.map((s) => s.name).join(',') || '(none)'}`);
  if (missing.length) console.log(`empty_slots=${missing.join(',')}`);

  if (present.length === 0) {
    console.error(
      'FAIL: No LLM keys set in server/.env. Set LLM_API_KEY and optionally LLM_API_KEY2, then re-run.',
    );
    process.exit(2);
  }

  const results = [];
  for (const slot of present) {
    process.stdout.write(`Probing ${slot.name} (len=${slot.value.trim().length})... `);
    const result = await probeOne(slot.name, slot.value.trim());
    results.push(result);
    if (result.ok) {
      console.log(`OK (${result.ms}ms) reply="${result.preview}"`);
    } else {
      console.log(`FAIL (${result.ms}ms) status=${result.status} ${result.message}`);
    }
  }

  // Deduped key pool order (same as app)
  const pool = uniq(slots.map((s) => s.value));
  console.log(`unique_keys_in_pool=${pool.length}`);

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('=== Summary ===');
  console.log(`passed=${passed.length} failed=${failed.length}`);
  if (failed.length) {
    process.exit(1);
  }
  console.log('All configured LLM keys responded successfully.');
}

main().catch((err) => {
  console.error('Probe crashed:', String(err.message || err).slice(0, 200));
  process.exit(1);
});

#!/usr/bin/env bun

const baseUrl = process.env.GBRAIN_INTERNAL_SMOKE_URL || 'http://127.0.0.1:7346';
const token = process.env.GBRAIN_INTERNAL_TOKEN || process.env.COMPENDIUM_GBRAIN_INTERNAL_TOKEN;
const requestTimeoutMs = Number.parseInt(process.env.GBRAIN_INTERNAL_SMOKE_TIMEOUT_MS || '20000', 10);

if (!token) {
  console.error('Set GBRAIN_INTERNAL_TOKEN or COMPENDIUM_GBRAIN_INTERNAL_TOKEN.');
  process.exit(2);
}

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

async function request(path: string, init: RequestInit = {}): Promise<JsonValue> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`${init.method || 'GET'} ${path} timed out after ${requestTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let body: JsonValue = null;
  if (text) {
    try {
      body = JSON.parse(text) as JsonValue;
    } catch {
      body = text;
    }
  }
  console.log(`${init.method || 'GET'} ${path} -> ${res.status}`);
  if (!res.ok) {
    console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    throw new Error(`${path} failed with HTTP ${res.status}`);
  }
  return body;
}

function assertRecord(value: JsonValue, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} did not return a JSON object`);
  }
  return value as Record<string, unknown>;
}

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let health: Response;
  try {
    health = await fetch(`${baseUrl}/health`, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`GET /health timed out after ${requestTimeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const healthText = await health.text();
  console.log(`GET /health -> ${health.status}`);
  if (!health.ok) throw new Error(`/health failed: ${healthText}`);

  const sourceId = `b-smoke-${Date.now().toString(36)}`;
  const pageSlug = `p-smoke-${Date.now().toString(36)}`;

  await request(`/internal/v1/sources/${sourceId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: `SteamSpire Smoke Bucket ${sourceId}` }),
  });

  await request(`/internal/v1/sources/${sourceId}/pages/${pageSlug}`, {
    method: 'PUT',
    body: JSON.stringify({
      document_id: `doc-${pageSlug}`,
      title: 'GBrain Postgres Smoke',
      content: 'SteamSpire tenant-shaped Postgres internal REST smoke needle.',
      content_hash: `sha256:${pageSlug}`,
      metadata: { bucket: 'smoke', smoke: true },
    }),
  });

  const search = assertRecord(await request('/internal/v1/search', {
    method: 'POST',
    body: JSON.stringify({
      query: 'tenant-shaped Postgres smoke needle',
      mode: 'search',
      source_ids: [sourceId],
      limit: 5,
    }),
  }), 'search');
  const results = Array.isArray(search.results) ? search.results : [];
  const found = results.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const result = row as Record<string, unknown>;
    return result.source_id === sourceId && result.slug === pageSlug;
  });
  if (!found) throw new Error('Scoped search did not return the smoke page.');

  const contextPack = assertRecord(await request('/internal/v1/context-pack', {
    method: 'POST',
    body: JSON.stringify({
      task: 'tenant-shaped Postgres smoke needle',
      source_ids: [sourceId],
      limit: 5,
    }),
  }), 'context-pack');
  const contextResults = Array.isArray(contextPack.search_results) ? contextPack.search_results : [];
  const contextFound = contextResults.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const result = row as Record<string, unknown>;
    return result.source_id === sourceId && result.slug === pageSlug;
  });
  if (!contextFound) throw new Error('Scoped context pack did not return the smoke page.');

  const empty = assertRecord(await request('/internal/v1/search', {
    method: 'POST',
    body: JSON.stringify({
      query: 'tenant-shaped Postgres smoke needle',
      mode: 'search',
      source_ids: [],
      limit: 5,
    }),
  }), 'empty-source search');
  if (Array.isArray(empty.results) && empty.results.length !== 0) {
    throw new Error('Empty source list returned results.');
  }

  const emptyContextPack = assertRecord(await request('/internal/v1/context-pack', {
    method: 'POST',
    body: JSON.stringify({
      task: 'tenant-shaped Postgres smoke needle',
      source_ids: [],
      limit: 5,
    }),
  }), 'empty-source context-pack');
  if (Array.isArray(emptyContextPack.search_results) && emptyContextPack.search_results.length !== 0) {
    throw new Error('Empty source list returned context-pack search results.');
  }

  await request(`/internal/v1/sources/${sourceId}/pages/${pageSlug}`, { method: 'DELETE' });

  console.log('SteamSpire internal REST smoke passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

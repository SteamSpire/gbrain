import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import {
  buildInternalContradictionCandidates,
  buildInternalGraphEdgesFromPaths,
  buildInternalPageMarkdown,
  decodeInternalEntityId,
  encodeInternalEntityId,
  normalizeStringArray,
} from '../src/commands/serve-http.ts';

describe('SteamSpire internal REST boundary', () => {
  test('serve-http exposes first-party internal routes without using MCP', () => {
    const src = readFileSync('src/commands/serve-http.ts', 'utf8');
    expect(src).toContain("app.use('/internal/v1', internalRouter)");
    expect(src).toContain("internalRouter.post('/search'");
    expect(src).toContain("internalRouter.post('/answer'");
    expect(src).toContain("internalRouter.post('/context-pack'");
    expect(src).toContain("internalRouter.post('/takes'");
    expect(src).toContain("internalRouter.patch('/takes/:takeId'");
    expect(src).toContain("internalRouter.post('/contradictions'");
    expect(src).toContain("internalRouter.post('/graph'");
    expect(src).toContain("internalRouter.post('/entities'");
    expect(src).toContain("internalRouter.post('/entity-documents'");
    expect(src).toContain("internalRouter.put('/sources/:sourceId/pages/:pageSlug'");
    expect(src).toContain("internalRouter.delete('/sources/:sourceId/pages/:pageSlug'");
    expect(src).toContain("runGather(engine");
    expect(src).toContain("operationsByName.think.handler");
    expect(src).toContain("operationsByName.put_page.handler");
    expect(src).toContain("operationsByName.delete_page.handler");
    expect(src).toContain("softDeleteSource(engine, sourceId)");
    expect(src).not.toMatch(/internalRouter[\s\S]{0,1200}\/mcp/);
  });

  test('source id list normalization drops non-string and blank entries', () => {
    expect(normalizeStringArray([' b-one ', '', 7, 'b-two'])).toEqual(['b-one', 'b-two']);
    expect(normalizeStringArray('b-one')).toEqual([]);
  });

  test('contradiction candidates pair positive and negated takes by normalized claim', () => {
    const candidates = buildInternalContradictionCandidates([
      { id: 1, source_id: 'b-one', page_slug: 'p-one', row_num: 1, claim: 'Use weekly reporting.', kind: 'take', holder: 'world', weight: 0.8 },
      { id: 2, source_id: 'b-one', page_slug: 'p-two', row_num: 1, claim: 'Do not use weekly reporting.', kind: 'take', holder: 'world', weight: 0.7 },
      { id: 3, source_id: 'b-one', page_slug: 'p-three', row_num: 1, claim: 'Use monthly reporting.', kind: 'take', holder: 'world', weight: 0.7 },
    ], 10);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].shared_key).toBe('use weekly reporting');
    expect(candidates[0].first_take.claim).toBe('Use weekly reporting.');
    expect(candidates[0].second_take.claim).toBe('Do not use weekly reporting.');
  });

  test('graph path edges become source-scoped internal graph edges', () => {
    const edges = buildInternalGraphEdgesFromPaths('b-one', [
      { from_slug: 'p-one', to_slug: 'p-two', link_type: 'mentions', context: 'evidence', depth: 1 },
      { from_slug: 'p-one', to_slug: 'p-two', link_type: 'mentions', context: 'duplicate', depth: 1 },
      { from_slug: 'p-two', to_slug: 'p-three', link_type: 'supports', context: '', depth: 2 },
    ], 10);

    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      id: 'gbrain:b-one:p-one:mentions:p-two',
      source_id: 'b-one',
      from_page_slug: 'p-one',
      to_page_slug: 'p-two',
      link_type: 'mentions',
      evidence_text: 'evidence',
    });
    expect(edges[1].depth).toBe(2);
  });

  test('entity ids round-trip source and slash-bearing page slugs', () => {
    const id = encodeInternalEntityId('b-one', 'companies/acme-inc');
    expect(id).toBe('gbrain:b-one:Y29tcGFuaWVzL2FjbWUtaW5j');
    expect(decodeInternalEntityId(id)).toEqual({
      source_id: 'b-one',
      page_slug: 'companies/acme-inc',
    });
    expect(decodeInternalEntityId('bad')).toBeNull();
  });

  test('page handoff becomes markdown with compendium provenance frontmatter', () => {
    const md = buildInternalPageMarkdown({
      document_id: 'doc-1',
      title: 'Launch Notes',
      content: 'Ship GBrain through Compendium.',
      content_hash: 'sha256:abc',
      metadata: { type: 'note', project: 'steamspire' },
    });

    expect(md).toContain('"title": "Launch Notes"');
    expect(md).toContain('"type": "note"');
    expect(md).toContain('"project": "steamspire"');
    expect(md).toContain('"source_kind": "compendium"');
    expect(md).toContain('"ingested_via": "steamspire-compendium"');
    expect(md).toContain('"compendium_document_id": "doc-1"');
    expect(md).toContain('"content_hash": "sha256:abc"');
    expect(md.endsWith('Ship GBrain through Compendium.')).toBe(true);
  });
});

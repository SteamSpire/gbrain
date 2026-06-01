import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import {
  buildInternalContradictionCandidates,
  buildInternalPageMarkdown,
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

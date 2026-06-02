import { describe, expect, test } from 'bun:test';
import type { BrainEngine } from '../src/core/engine.ts';
import { buildReport, formatText } from '../src/commands/models.ts';
import { withEnv } from './helpers/with-env.ts';

function stubEngine(values: Record<string, string | undefined> = {}): BrainEngine {
  return {
    async getConfig(key: string) {
      return values[key] ?? null;
    },
  } as unknown as BrainEngine;
}

describe('gbrain models — Gauge-managed env report', () => {
  test('reports managed chat, think, and fallback-chain env without secrets', async () => {
    await withEnv(
      {
        GBRAIN_MODEL_CHAT: 'openai:gpt-5.5',
        GBRAIN_MODEL_THINK: 'openrouter:openai/gpt-5.5',
        GBRAIN_CHAT_FALLBACK_CHAIN: 'anthropic:claude-opus-4-7, openrouter:anthropic/claude-opus-4-7',
        GBRAIN_MODEL: undefined,
      },
      async () => {
        const report = await buildReport(stubEngine());

        expect(report.managed_env.GBRAIN_MODEL_CHAT).toEqual({
          env_var: 'GBRAIN_MODEL_CHAT',
          config_key: 'models.chat',
          value: 'openai:gpt-5.5',
          models: ['openai:gpt-5.5'],
        });
        expect(report.managed_env.GBRAIN_MODEL_THINK).toEqual({
          env_var: 'GBRAIN_MODEL_THINK',
          config_key: 'models.think',
          value: 'openrouter:openai/gpt-5.5',
          models: ['openrouter:openai/gpt-5.5'],
        });
        expect(report.managed_env.GBRAIN_CHAT_FALLBACK_CHAIN).toEqual({
          env_var: 'GBRAIN_CHAT_FALLBACK_CHAIN',
          config_key: null,
          value: 'anthropic:claude-opus-4-7, openrouter:anthropic/claude-opus-4-7',
          models: [
            'anthropic:claude-opus-4-7',
            'openrouter:anthropic/claude-opus-4-7',
          ],
        });

        const text = formatText(report);
        expect(text).toContain('Gauge-managed env:');
        expect(text).toContain('GBRAIN_MODEL_CHAT');
        expect(text).toContain('openai:gpt-5.5');
        expect(text).toContain('GBRAIN_MODEL_THINK');
        expect(text).toContain('openrouter:openai/gpt-5.5');
        expect(text).toContain('GBRAIN_CHAT_FALLBACK_CHAIN');
        expect(text).toContain('anthropic:claude-opus-4-7, openrouter:anthropic/claude-opus-4-7');
      },
    );
  });
});

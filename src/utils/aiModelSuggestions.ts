/**
 * @file src/utils/aiModelSuggestions.ts
 * @description Sugerencias de modelo por proveedor para el campo de modelo de Ajustes (lista `datalist`; el
 * texto libre sigue permitido). Son identificadores públicos de modelos; no afectan a la seguridad.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { AiCompatPresetId, AiConfig } from '../types/kura';

const NATIVE: Record<Exclude<AiConfig['provider'], 'openai_compatible'>, string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  ollama: ['llama3.1', 'qwen2.5', 'mistral', 'gemma2'],
};

const PRESETS: Record<AiCompatPresetId, string[]> = {
  deepseek: ['deepseek-flash', 'deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
  openrouter: ['openrouter/auto'],
  lmstudio: ['local-model'],
  ollama: ['llama3.1', 'qwen2.5', 'mistral'],
  custom: [],
};

/** Modelos sugeridos para el proveedor (y preset) activo. */
export function modelSuggestions(config: Pick<AiConfig, 'provider' | 'compatPreset'>): string[] {
  if (config.provider === 'openai_compatible') return PRESETS[config.compatPreset ?? 'custom'];
  return NATIVE[config.provider];
}

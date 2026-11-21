/**
 * @file src/ai/providerCatalog.ts
 * @description Catálogo de proveedores IA y presets del proveedor genérico compatible con OpenAI
 * (DeepSeek, Qwen/DashScope, OpenRouter, LM Studio, Ollama y personalizado). Define la ranura del
 * llavero de cada uno: debe coincidir con `PROVIDERS` de `src-tauri/src/ai_credentials.rs` y con
 * `slot_policy` de `src-tauri/src/ai_hosts.rs`.
 * URL base verificadas en la documentación oficial (noviembre 2026); son editables en Ajustes.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AiCompatPresetId, AiConfig, AiProviderType } from '../types/kura';

/** Ranuras de clave del llavero (una por proveedor nativo o preset). */
export type AiKeySlot =
  | 'gemini' | 'openai' | 'anthropic' | 'ollama'
  | 'deepseek' | 'qwen' | 'openrouter' | 'lmstudio' | 'custom';

export const AI_KEY_SLOTS: readonly AiKeySlot[] = [
  'gemini', 'openai', 'anthropic', 'ollama', 'deepseek', 'qwen', 'openrouter', 'lmstudio', 'custom',
];

/** Cómo se adjunta la clave de cada ranura (en escritorio lo decide Rust con la misma tabla). */
export type AuthScheme = 'bearer' | 'x-goog-api-key' | 'x-api-key';

export interface ProviderSpec {
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  needsKey: boolean;
}

export const PROVIDERS: Record<Exclude<AiProviderType, 'openai_compatible'>, ProviderSpec> = {
  gemini: {
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    needsKey: true,
  },
  openai: { label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', needsKey: true },
  anthropic: {
    label: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
    needsKey: true,
  },
  ollama: { label: 'Ollama', defaultBaseUrl: 'http://127.0.0.1:11434', defaultModel: 'llama3.1', needsKey: false },
};

export const COMPAT_PRESETS: Record<AiCompatPresetId, ProviderSpec> = {
  deepseek: { label: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-flash', needsKey: true },
  qwen: {
    label: 'Qwen (DashScope)',
    defaultBaseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    needsKey: true,
  },
  openrouter: {
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    needsKey: true,
  },
  lmstudio: { label: 'LM Studio', defaultBaseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model', needsKey: false },
  ollama: { label: 'Ollama (OpenAI)', defaultBaseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.1', needsKey: false },
  // Clave opcional: un servidor propio puede no pedirla.
  custom: { label: 'Custom', defaultBaseUrl: '', defaultModel: '', needsKey: false },
};

export const COMPAT_PRESET_IDS = Object.keys(COMPAT_PRESETS) as AiCompatPresetId[];

/** Especificación efectiva (proveedor nativo o preset compatible). */
export function specFor(config: Pick<AiConfig, 'provider' | 'compatPreset'>): ProviderSpec {
  if (config.provider === 'openai_compatible') return COMPAT_PRESETS[config.compatPreset ?? 'custom'];
  return PROVIDERS[config.provider];
}

/** Ranura del llavero que usa la configuración. */
export function keySlotFor(config: Pick<AiConfig, 'provider' | 'compatPreset'>): AiKeySlot {
  if (config.provider !== 'openai_compatible') return config.provider;
  return config.compatPreset ?? 'custom';
}

export function authSchemeFor(slot: AiKeySlot): AuthScheme {
  if (slot === 'gemini') return 'x-goog-api-key';
  if (slot === 'anthropic') return 'x-api-key';
  return 'bearer';
}

/** Nombre visible del proveedor activo (incluye el preset compatible). */
export function providerLabel(config: Pick<AiConfig, 'provider' | 'compatPreset'>): string {
  return specFor(config).label;
}

/** True si el proveedor puede usarse: no requiere clave o hay una (en memoria o en el llavero). */
export function hasUsableCredentials(config: AiConfig): boolean {
  return !specFor(config).needsKey || config.apiKey.trim().length > 0 || config.keyStored === true;
}

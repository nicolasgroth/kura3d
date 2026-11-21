/**
 * @file src/ai/aiConfigState.ts
 * @description Lectura y normalización de la configuración IA persistida (sin clave) y sincronización del
 * estado de la clave con el almacén seguro. Migra la configuración antigua "OpenAI / Compatible" con URL
 * propia al proveedor genérico compatible con OpenAI.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AiCompatPresetId, AiConfig, AiProviderType } from '../types/kura';
import type { ApiKeyStore } from './apiKeyStore';
import { COMPAT_PRESET_IDS, keySlotFor, PROVIDERS } from './providerCatalog';

const PROVIDER_IDS: readonly AiProviderType[] = ['gemini', 'openai', 'anthropic', 'ollama', 'openai_compatible'];

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  baseUrl: '',
  temperature: 0.2,
  compatPreset: 'deepseek',
  keyStored: false,
};

function officialOpenAi(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.toLowerCase() === 'api.openai.com';
  } catch {
    return false;
  }
}

/** Normaliza el JSON persistido. La clave nunca viene de aquí (solo la heredada en memoria, web). */
export function parseStoredAiConfig(raw: string | null, legacyKey = ''): AiConfig {
  const base: AiConfig = { ...DEFAULT_AI_CONFIG, apiKey: legacyKey };
  if (!raw) return base;
  let parsed: Partial<AiConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<AiConfig>;
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== 'object') return base;
  let provider = PROVIDER_IDS.includes(parsed.provider as AiProviderType) ? (parsed.provider as AiProviderType) : base.provider;
  const baseUrl = typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '';
  let compatPreset = COMPAT_PRESET_IDS.includes(parsed.compatPreset as AiCompatPresetId)
    ? (parsed.compatPreset as AiCompatPresetId)
    : base.compatPreset;
  // "OpenAI / Compatible" con URL propia pasa al proveedor genérico: la clave de OpenAI solo viaja a OpenAI.
  if (provider === 'openai' && baseUrl.trim() && !officialOpenAi(baseUrl.trim())) {
    provider = 'openai_compatible';
    compatPreset = 'custom';
  }
  const fallbackModel = provider === 'openai_compatible' ? '' : PROVIDERS[provider].defaultModel;
  return {
    provider,
    apiKey: legacyKey,
    model: typeof parsed.model === 'string' && parsed.model ? parsed.model : fallbackModel,
    baseUrl,
    temperature: typeof parsed.temperature === 'number' && Number.isFinite(parsed.temperature)
      ? Math.min(1, Math.max(0, parsed.temperature))
      : base.temperature,
    compatPreset,
    keyStored: false,
  };
}

/** Lo que se guarda en `localStorage`: todo menos la clave y el estado del llavero. */
export function persistableAiConfig(config: AiConfig): Omit<AiConfig, 'apiKey' | 'keyStored'> {
  const { apiKey: _key, keyStored: _stored, ...rest } = config;
  return rest;
}

/**
 * Estado de la clave de la ranura activa: en web, la clave en memoria; en escritorio, solo si existe
 * (el valor queda en el llavero y lo adjunta el proxy nativo).
 */
export async function loadKeyState(config: AiConfig, store: ApiKeyStore): Promise<Pick<AiConfig, 'apiKey' | 'keyStored'>> {
  const slot = keySlotFor(config);
  if (store.desktop) {
    const stored = await store.has(slot).catch(() => false);
    return { apiKey: '', keyStored: stored };
  }
  const apiKey = await store.load(slot).catch(() => '');
  return { apiKey, keyStored: false };
}

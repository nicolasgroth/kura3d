/**
 * @file src/utils/aiBadges.ts
 * @description Helper centralizado para distinguir explícitamente entre modo 100% Local,
 * IA Local (Ollama) e IA Externa (Gemini / OpenAI / Anthropic) en toda la interfaz de Kura3D.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import type { AiConfig, AiProviderType, LanguageCode } from '../types/kura';

export type AiExecutionMode = 'ollama' | 'external' | 'local';

export interface AiBadgeDescriptor {
  mode: AiExecutionMode;
  providerLabel: string;
  label: string;
  tooltip: string;
  cssTone: 'emerald' | 'amber' | 'cyan';
}

const PROVIDER_DISPLAY_NAMES: Record<AiProviderType, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
};

/**
 * Calcula la etiqueta de privacidad/origen de IA a partir de la configuración activa.
 */
export function getAiBadgeDescriptor(
  aiConfig: AiConfig,
  lang: LanguageCode,
): AiBadgeDescriptor {
  const providerLabel = PROVIDER_DISPLAY_NAMES[aiConfig.provider] ?? aiConfig.provider;

  if (aiConfig.provider === 'ollama') {
    return {
      mode: 'ollama',
      providerLabel,
      label: t(lang, 'badge.localOllama'),
      tooltip: t(lang, 'badge.localOllamaTip'),
      cssTone: 'emerald',
    };
  }

  if (aiConfig.apiKey.trim().length > 0) {
    return {
      mode: 'external',
      providerLabel,
      label: t(lang, 'badge.externalAi', { provider: providerLabel }),
      tooltip: t(lang, 'badge.externalAiTip', { provider: providerLabel }),
      cssTone: 'amber',
    };
  }

  return {
    mode: 'local',
    providerLabel,
    label: t(lang, 'badge.localNoAi'),
    tooltip: t(lang, 'badge.localNoAiTip'),
    cssTone: 'cyan',
  };
}

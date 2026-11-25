/**
 * @file src/utils/aiBadges.ts
 * @description Helper centralizado para distinguir explícitamente entre modo 100% Local,
 * IA Local (Ollama) e IA Externa (Gemini / OpenAI / Anthropic) en toda la interfaz de Kurra Studio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../i18n';
import { hasUsableCredentials, providerLabel as labelFor, specFor } from '../ai/providerCatalog';
import type { AiConfig, LanguageCode } from '../types/kura';

export type AiExecutionMode = 'ollama' | 'external' | 'local';

export interface AiBadgeDescriptor {
  mode: AiExecutionMode;
  providerLabel: string;
  label: string;
  tooltip: string;
  cssTone: 'emerald' | 'amber' | 'cyan';
}

/**
 * Calcula la etiqueta de privacidad/origen de IA a partir de la configuración activa.
 */
export function getAiBadgeDescriptor(
  aiConfig: AiConfig,
  lang: LanguageCode,
): AiBadgeDescriptor {
  const providerLabel = labelFor(aiConfig);
  // Servidores locales sin clave (Ollama, LM Studio): los prompts no salen del equipo.
  const local = aiConfig.provider === 'ollama' || (aiConfig.provider === 'openai_compatible' && !specFor(aiConfig).needsKey
    && /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(aiConfig.baseUrl.trim() || specFor(aiConfig).defaultBaseUrl));

  if (local) {
    return {
      mode: 'ollama',
      providerLabel,
      label: t(lang, 'badge.localOllama'),
      tooltip: t(lang, 'badge.localOllamaTip'),
      cssTone: 'emerald',
    };
  }

  if (hasUsableCredentials(aiConfig)) {
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

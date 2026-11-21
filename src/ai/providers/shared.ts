/**
 * @file src/ai/providers/shared.ts
 * @description Entrada común de los adaptadores de proveedor IA: historial recortado, prompt de sistema y
 * esquemas de herramientas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { AiChatMessage, AiConfig, LanguageCode } from '../../types/kura';
import type { AiKeySlot } from '../providerCatalog';

export interface AdapterInput {
  prompt: string;
  history: AiChatMessage[];
  config: AiConfig;
  lang: LanguageCode;
  /** URL base ya validada, sin barra final. */
  baseUrl: string;
  model: string;
  keySlot: AiKeySlot;
  timeoutMs?: number;
}

/** Últimos turnos de usuario/asistente enviados como contexto. */
export function recentTurns(history: AiChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter((m): m is AiChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function buildSystemPrompt(lang: LanguageCode): string {
  if (lang === 'es') {
    return (
      'Eres el Asistente de Kura3D, experto en modelado CAD 3D e impresión 3D. ' +
      'Las unidades internas de la escena están en milímetros (mm), con eje Y hacia arriba (Y=0 es la cama). ' +
      'Usa siempre las herramientas disponibles cuando el usuario pida crear, transformar, ahuecar, cortar o exportar geometría. ' +
      'No modifiques objetos existentes que el usuario no haya nombrado. ' +
      'Responde en español de forma clara, breve y precisa, con las dimensiones reales.'
    );
  }
  return (
    'You are Kura3D Assistant, a precision 3D CAD and 3D-printing modeling expert. ' +
    'Internal scene units are millimeters (mm), Y-up (Y=0 is the build plate). ' +
    'Always use the provided tools to inspect or modify the 3D scene when the user asks to create, edit, hollow, cut, or export geometry. ' +
    'Never modify existing objects the user did not name. ' +
    `Be concise, accurate, and report actual dimensions. Reply in the user's language (UI language: ${lang}).`
  );
}

export const JSON_HEADERS = { 'content-type': 'application/json' } as const;

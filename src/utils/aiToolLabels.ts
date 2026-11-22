/**
 * @file src/utils/aiToolLabels.ts
 * @description Traduce el identificador interno de una herramienta de IA ("create_primitive") a un texto
 * en lenguaje natural localizado ("Creé una pieza"), para que el chat nunca muestre nombres internos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';

const TOOL_LABEL_KEYS: Record<string, TranslationKey> = {
  create_primitive: 'ai.tool.create_primitive',
  update_primitive_params: 'ai.tool.update_primitive_params',
  transform_object: 'ai.tool.transform_object',
  hollow_object: 'ai.tool.hollow_object',
  boolean_operation: 'ai.tool.boolean_operation',
  plane_cut: 'ai.tool.plane_cut',
  apply_texture: 'ai.tool.apply_texture',
  duplicate_object: 'ai.tool.duplicate_object',
  delete_object: 'ai.tool.delete_object',
  export_stl: 'ai.tool.export_stl',
  export_3mf: 'ai.tool.export_3mf',
  get_scene_state: 'ai.tool.get_scene_state',
};

/** Clave de traducción de la herramienta, o la genérica si no se conoce. */
export function toolLabelKey(name: string | undefined): TranslationKey {
  return (name !== undefined && Object.hasOwn(TOOL_LABEL_KEYS, name) ? TOOL_LABEL_KEYS[name] : undefined)
    ?? 'ai.tool.unknown';
}

/** Texto localizado de la acción que ejecutó el asistente. */
export function toolLabel(language: LanguageCode, name: string | undefined): string {
  return t(language, toolLabelKey(name));
}

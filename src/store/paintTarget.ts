/**
 * @file src/store/paintTarget.ts
 * @description Texto único de «a qué objeto va la pintura»: lo usan la barra del visor y el panel derecho de la
 * herramienta Pintar, así dicen lo mismo con cualquier selección (ninguno, uno o varios). Función pura.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../i18n';
import type { LanguageCode, SceneObject } from '../types/kura';

export interface PaintTargetText {
  /** Frase lista para mostrar. */
  text: string;
  /** Nombre del objeto principal (para el `title`), o `null` sin selección. */
  name: string | null;
}

/** Objeto principal de la selección (el primero que existe) y cuántos más hay seleccionados. */
export function paintTargetOf(objects: readonly SceneObject[], selectedIds: readonly string[]): { primary: SceneObject | null; others: number } {
  const picked = selectedIds.map((id) => objects.find((o) => o.id === id)).filter((o): o is SceneObject => Boolean(o));
  return { primary: picked[0] ?? null, others: Math.max(0, picked.length - 1) };
}

export function paintTargetText(language: LanguageCode, objects: readonly SceneObject[], selectedIds: readonly string[]): PaintTargetText {
  const { primary, others } = paintTargetOf(objects, selectedIds);
  if (!primary) return { text: t(language, 'viewport.paint.noTarget'), name: null };
  if (others === 0) return { text: t(language, 'viewport.paint.target', { name: primary.name }), name: primary.name };
  return { text: t(language, 'ux8.paint.targetMany', { name: primary.name, count: others }), name: primary.name };
}

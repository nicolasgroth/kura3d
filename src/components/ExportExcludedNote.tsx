/**
 * @file src/components/ExportExcludedNote.tsx
 * @description Nota bajo «Escena completa (N)» del diálogo Exportar: explica por qué el conteo es menor que
 * el del árbol («15 de 16: 1 oculto no se exporta»), contando ocultos y negativos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../i18n';
import { isNegative } from '../core/scene/objectRole';
import type { LanguageCode, SceneObject } from '../types/kura';

export const ExportExcludedNote: React.FC<{ objects: readonly SceneObject[]; exportable: number; language: LanguageCode }> = ({ objects, exportable, language }) => {
  const hidden = objects.filter((o) => !o.visible).length;
  const negatives = objects.filter((o) => o.visible && isNegative(o)).length;
  if (hidden === 0 && negatives === 0) return null;
  const parts = [
    hidden > 0 ? t(language, 'ux7.export.hidden', { count: hidden }) : null,
    negatives > 0 ? t(language, 'ux7.export.negatives', { count: negatives }) : null,
  ].filter(Boolean);
  return (
    <p className="kura-gen-note" data-testid="export-excluded" style={{ fontSize: 12, margin: '2px 0 0' }}>
      {t(language, 'ux7.export.excluded', { count: exportable, total: objects.length, excluded: hidden + negatives, list: parts.join(t(language, 'ux7.export.and')) })}
    </p>
  );
};

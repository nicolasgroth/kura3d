/**
 * @file src/components/split/SplitPartInfo.tsx
 * @description Tarjeta del inspector para una pieza de una división: código, placa de impresión y
 * marcas de pareja ("Se une con A2 por la unión 3").
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';

export const SplitPartInfo: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const meta = primary.metadata?.split;
  if (!meta) return null;
  const partners = meta.jointPartners ?? meta.jointLabels.map((label) => ({ label, code: '?' }));
  return (
    <div className="kura-form-field kura-split-part-info">
      <label>{t(language, 'split.part.title', { code: meta.code })}</label>
      <small className="kura-cut-hint">{t(language, 'split.part.plate', { n: meta.print.plate + 1 })}</small>
      {partners.length > 0 ? (
        <ul className="kura-split-joints">
          {partners.map((p) => (
            <li key={`${p.label}-${p.code}`}>{t(language, 'split.part.joinsWith', { code: p.code, label: p.label })}</li>
          ))}
        </ul>
      ) : (
        <small className="kura-cut-hint">{t(language, 'split.part.noJoints')}</small>
      )}
    </div>
  );
};

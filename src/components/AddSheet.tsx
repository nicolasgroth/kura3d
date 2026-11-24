/**
 * @file src/components/AddSheet.tsx
 * @description Hoja «Agregar» de pantallas estrechas: las mismas entradas que «Agregar» e «Insertar»
 * (`store/insertCatalog.ts`) como botones grandes con icono y nombre, en dos grupos (formas básicas y
 * generadores). Deshabilitadas con su motivo mientras corre una operación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { t } from '../i18n';
import { GENERATORS, insertLabelKey, insertTipKey, runInsert, SHAPES, type InsertId } from '../store/insertCatalog';
import { useKuraStore } from '../store/useKuraStore';
import { insertIcon } from './shell/insertIcons';

export const AddSheet: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const blocked = useKuraStore((s) => Boolean(s.busyOperation) || s.projectBusy);

  const card = (id: InsertId) => {
    const name = t(language, insertLabelKey(id));
    const tipKey = insertTipKey(id);
    const tip = blocked ? t(language, 'r3a.project.blocked') : tipKey ? t(language, tipKey) : t(language, 'r3a.insert.shapeTip', { name });
    return (
      <button key={id} type="button" className="kura-primitive-card" title={tip} disabled={blocked} onClick={() => void runInsert(id)}>
        <span className="kura-primitive-icon">{insertIcon(id, 19)}</span>
        <span>{name}</span>
      </button>
    );
  };

  return (
    <div className="kura-scroll-area" data-testid="add-sheet">
      <section>
        <h2 className="kura-section-label">{t(language, 'r3a.insert.shapes')}</h2>
        <div className="kura-primitive-grid">{SHAPES.map((shape) => card(shape.id))}</div>
      </section>
      <section>
        <h2 className="kura-section-label">{t(language, 'r3a.insert.generators')}</h2>
        <div className="kura-primitive-grid">{GENERATORS.map((id) => card(id))}</div>
      </section>
    </div>
  );
};

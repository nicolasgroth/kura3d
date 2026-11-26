/**
 * @file src/components/shell/InsertMenus.tsx
 * @description Menús para agregar a la escena, ambos sobre el catálogo `store/insertCatalog.ts`:
 * - `AddRailButton`: botón «Agregar» de la barra vertical; abre a su derecha el mismo menú que «Insertar»
 *   (formas y generadores) con icono y nombre. → abre, ↑/↓ recorren, Enter elige, Esc cierra y devuelve el foco.
 * - `InsertMenu`: menú «Insertar» de la barra superior con las mismas formas y los generadores (Importar SVG,
 *   Imagen → 3D, Rosca ISO, Cubo de calibración).
 * Mientras el motor no está listo o hay una operación en curso, las entradas quedan deshabilitadas con su motivo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { ChevronDown, Plus, SquarePlus } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { GENERATORS, insertLabelKey, insertTipKey, runInsert, SHAPES, type InsertId } from '../../store/insertCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { MenuGroup, MenuItem } from '../viewport/contextMenu/MenuKit';
import { helpAttrs } from './controlHelp';
import { insertIcon } from './insertIcons';
import { usePortalMenu } from './usePortalMenu';

/** Motivo por el que no se puede agregar ahora (o `null`). */
function useInsertBlockedReason(): string | null {
  const language = useKuraStore((s) => s.language);
  const blocked = useKuraStore((s) => Boolean(s.busyOperation) || s.projectBusy);
  return blocked ? t(language, 'r3a.project.blocked') : null;
}

function useItems(pick: (fn: () => unknown) => () => void) {
  const language = useKuraStore((s) => s.language);
  const reason = useInsertBlockedReason();
  return (id: InsertId) => {
    const name = t(language, insertLabelKey(id));
    const tipKey = insertTipKey(id);
    const tip = tipKey ? t(language, tipKey) : t(language, 'r3a.insert.shapeTip', { name });
    return (
      <MenuItem
        key={id}
        icon={insertIcon(id)}
        label={name}
        tip={reason ? t(language, 'rediseno.reason.disabled', { reason }) : tip}
        disabled={Boolean(reason)}
        onSelect={pick(() => runInsert(id))}
      />
    );
  };
}

/** Formas y generadores del catálogo: el mismo contenido para «Agregar» y para «Insertar». */
const InsertSections: React.FC<{ item: (id: InsertId) => React.ReactNode }> = ({ item }) => {
  const language = useKuraStore((s) => s.language);
  return (
    <>
      <MenuGroup title={t(language, 'r3a.insert.shapes' as TranslationKey)}>{SHAPES.map((shape) => item(shape.id))}</MenuGroup>
      <MenuGroup title={t(language, 'r3a.insert.generators')}>{GENERATORS.map((id) => item(id))}</MenuGroup>
    </>
  );
};

export const AddRailButton: React.FC<{
  tabIndex: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onFocus: () => void;
}> = ({ tabIndex, buttonRef, onFocus }) => {
  const language = useKuraStore((s) => s.language);
  const menu = usePortalMenu('right');
  const item = useItems(menu.pick);
  const name = t(language, 'r3a.add.button');
  const { ref, ...trigger } = menu.triggerProps;
  return (
    <>
      <button
        ref={(el) => {
          ref.current = el;
          buttonRef(el);
        }}
        type="button"
        className={`kura-tool-rail-btn kura-tool-rail-add${menu.open ? ' is-active' : ''}`}
        aria-label={name}
        tabIndex={tabIndex}
        onFocus={onFocus}
        {...trigger}
        {...helpAttrs('tool.add', language)}
      >
        <SquarePlus size={20} aria-hidden="true" />
        <span className="kura-tool-rail-label" aria-hidden="true">{name}</span>
      </button>
      {menu.render(t(language, 'r3a.add.menu'), <InsertSections item={item} />)}
    </>
  );
};

export const InsertMenu: React.FC<{ showLabel: boolean }> = ({ showLabel }) => {
  const language = useKuraStore((s) => s.language);
  const menu = usePortalMenu('below');
  const item = useItems(menu.pick);
  const label = t(language, 'r3a.insert.menu');
  return (
    <>
      <button
        type="button"
        className={`kura-btn kura-btn-sm kura-insert-trigger${menu.open ? ' is-active' : ''}`}
        aria-label={label}
        {...menu.triggerProps}
        {...helpAttrs('top.insert', language)}
      >
        <Plus size={13} aria-hidden="true" />
        {showLabel && <span className="kura-btn-label">{label}</span>}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {menu.render(label, <InsertSections item={item} />)}
    </>
  );
};

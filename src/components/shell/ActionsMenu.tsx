/**
 * @file src/components/shell/ActionsMenu.tsx
 * @description Menú «Acciones» de la barra superior: botón con `aria-haspopup="menu"` que abre un menú
 * accesible (`role="menu"`, flechas, Inicio/Fin, → y ← para submenús, Esc cierra y devuelve el foco) con un
 * submenú por grupo del catálogo (`store/actionsCatalog.ts`), cada uno con su icono, y dentro las operaciones
 * con sus atajos a la derecha. Un ítem
 * deshabilitado muestra debajo por qué (sin selección, bloqueado, tipo no válido…). Reutiliza las piezas del
 * menú contextual (`MenuKit`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { ChevronDown, Zap } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ActionGroupMenus } from './ActionGroupMenus';
import { helpAttrs } from './controlHelp';
import { usePortalMenu } from './usePortalMenu';

export const ActionsMenu: React.FC<{ showLabel: boolean }> = ({ showLabel }) => {
  const language = useKuraStore((s) => s.language);
  const menu = usePortalMenu('below');
  const { pick } = menu;

  const label = t(language, 'rediseno.actions.menu');

  return (
    <>
      <button
        type="button"
        className={`kura-btn kura-btn-sm kura-actions-trigger${menu.open ? ' is-active' : ''}`}
        aria-label={label}
        {...menu.triggerProps}
        {...helpAttrs('top.actions', language)}
      >
        <Zap size={13} aria-hidden="true" />
        {showLabel && <span className="kura-btn-label">{label}</span>}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {menu.render(label, <ActionGroupMenus pick={pick} />)}
    </>
  );
};

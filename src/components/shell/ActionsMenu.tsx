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
import {
  AlignCenter,
  ArrowDownToLine,
  Box,
  Boxes,
  ChevronDown,
  Combine,
  Crosshair,
  Grid3x3,
  Group,
  Layers,
  Merge,
  Minimize2,
  Move3d,
  PaintBucket,
  Printer,
  Puzzle,
  Ruler,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Split,
  ToggleLeft,
  Triangle,
  Type,
  Ungroup,
  Wand2,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { OBJECT_ROLES } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import { ACTION_GROUPS, ACTION_SHORTCUTS, actionAvailability, type ActionGroupId, type ActionId } from '../../store/actionsCatalog';
import { ROLE_LABEL_KEY } from '../../store/roleLabels';
import { useKuraStore } from '../../store/useKuraStore';
import { MenuItem, SubMenu } from '../viewport/contextMenu/MenuKit';
import { ALIGN_MODES } from '../viewport/contextMenu/ObjectMenuPosition';
import { helpAttrs, MOD_LABEL } from './controlHelp';
import { runAction, runAlign, runConvert } from './actionRunners';
import { usePortalMenu } from './usePortalMenu';

const ICONS: Record<ActionId, React.ReactNode> = {
  hollow: <Box size={14} aria-hidden="true" />,
  splitForBed: <Grid3x3 size={14} aria-hidden="true" />,
  fitToBed: <Minimize2 size={14} aria-hidden="true" />,
  mold: <PaintBucket size={14} aria-hidden="true" />,
  project: <Type size={14} aria-hidden="true" />,
  modules: <Puzzle size={14} aria-hidden="true" />,
  texture: <Waves size={14} aria-hidden="true" />,
  repair: <Wrench size={14} aria-hidden="true" />,
  simplify: <Sparkles size={14} aria-hidden="true" />,
  refine: <Wand2 size={14} aria-hidden="true" />,
  hull: <Box size={14} aria-hidden="true" />,
  splitColors: <Sparkles size={14} aria-hidden="true" />,
  splitParts: <Split size={14} aria-hidden="true" />,
  group: <Group size={14} aria-hidden="true" />,
  ungroup: <Ungroup size={14} aria-hidden="true" />,
  combine: <Boxes size={14} aria-hidden="true" />,
  union: <Merge size={14} aria-hidden="true" />,
  applyHoles: <Combine size={14} aria-hidden="true" />,
  convert: <ToggleLeft size={14} aria-hidden="true" />,
  dropToBed: <ArrowDownToLine size={14} aria-hidden="true" />,
  centerOnBed: <Crosshair size={14} aria-hidden="true" />,
  align: <AlignCenter size={14} aria-hidden="true" />,
  validate: <ShieldCheck size={14} aria-hidden="true" />,
  detect: <ScanSearch size={14} aria-hidden="true" />,
  fitCheck: <Ruler size={14} aria-hidden="true" />,
};

const GROUP_ICONS: Record<ActionGroupId, React.ReactNode> = {
  prepare: <Printer size={14} aria-hidden="true" />,
  mesh: <Triangle size={14} aria-hidden="true" />,
  organize: <Layers size={14} aria-hidden="true" />,
  position: <Move3d size={14} aria-hidden="true" />,
  analyze: <ScanSearch size={14} aria-hidden="true" />,
};

export const ActionsMenu: React.FC<{ showLabel: boolean }> = ({ showLabel }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const menu = usePortalMenu('below');
  const { pick } = menu;

  const state = { objects, selectedIds, groups, busyOperation };
  const label = t(language, 'rediseno.actions.menu');

  const item = (id: ActionId) => {
    const availability = actionAvailability(state, id);
    const shortcut = ACTION_SHORTCUTS[id];
    const name = t(language, `rediseno.action.${id}` as TranslationKey);
    const reason = availability.reason ? t(language, availability.reason) : undefined;
    if (id === 'convert') {
      return (
        <SubMenu key={id} icon={ICONS[id]} label={name} tip={reason} disabled={!availability.enabled}>
          {OBJECT_ROLES.map((role) => (
            <MenuItem key={role} label={t(language, ROLE_LABEL_KEY[role])} onSelect={pick(() => runConvert(role))} />
          ))}
        </SubMenu>
      );
    }
    if (id === 'align') {
      return (
        <SubMenu key={id} icon={ICONS[id]} label={name} tip={reason} disabled={!availability.enabled}>
          {ALIGN_MODES.map((mode) => (
            <MenuItem key={mode} label={t(language, `align.label.${mode}`)} tip={t(language, `align.tip.${mode}`)} onSelect={pick(() => runAlign(mode))} />
          ))}
          <MenuItem label={t(language, 'inspector.pro.arrangeGrid')} onSelect={pick(() => runAlign('arrange_grid'))} />
        </SubMenu>
      );
    }
    return (
      <MenuItem
        key={id}
        icon={ICONS[id]}
        label={name}
        tip={reason ? t(language, 'rediseno.reason.disabled', { reason }) : name}
        description={reason}
        shortcut={shortcut?.label.replace('Ctrl', MOD_LABEL)}
        keys={shortcut?.keys}
        disabled={!availability.enabled}
        onSelect={pick(() => runAction(id))}
      />
    );
  };

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
      {menu.render(
        label,
        // Un submenú por grupo (con icono): el menú principal queda corto y cada acción conserva su motivo.
        ACTION_GROUPS.map((group) => {
          const name = t(language, `rediseno.actions.group.${group.id}` as TranslationKey);
          return (
            <SubMenu key={group.id} icon={GROUP_ICONS[group.id]} label={name} tip={t(language, 'r3a.actions.groupTip', { name, count: group.items.length })}>
              {group.items.map((id) => item(id))}
            </SubMenu>
          );
        }),
      )}
    </>
  );
};

/**
 * @file src/components/shell/ActionGroupMenus.tsx
 * @description Submenús del catálogo de acciones (Preparar, Malla, Organizar, Posición, Analizar) con sus iconos,
 * atajos, motivo de deshabilitado y nombre único (`store/actionLabels.ts`). Los comparten el menú «Acciones» de la
 * barra y el menú contextual del objeto, así que los dos ofrecen los mismos grupos en el mismo orden. Cada
 * entrada recibe `pick` (cierra el menú y ejecuta) y puede sumar ítems propios al final de un grupo.
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
  Rotate3d,
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
  Feather,
  Waves,
  Wrench,
} from 'lucide-react';
import { OBJECT_ROLES } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import { plateToolBlockReason } from '../../core/scene/viewMode';
import { ACTION_GROUPS, ACTION_SHORTCUTS, actionAvailability, type ActionGroupId, type ActionId } from '../../store/actionsCatalog';
import { ACTION_DESCRIPTION_KEY, ACTION_TIP_KEY, actionName } from '../../store/actionLabels';
import { ROLE_LABEL_KEY } from '../../store/roleLabels';
import { useKuraStore } from '../../store/useKuraStore';
import type { ObjectRole } from '../../types/kura';
import { MenuItem, SubMenu } from '../viewport/contextMenu/MenuKit';
import { ALIGN_MODES } from '../viewport/contextMenu/ObjectMenuPosition';
import { MOD_LABEL } from './controlHelp';
import { runAction, runAlign, runConvert } from './actionRunners';

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
  smooth: <Feather size={14} aria-hidden="true" />,
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
  orient: <Rotate3d size={14} aria-hidden="true" />,
};

const GROUP_ICONS: Record<ActionGroupId, React.ReactNode> = {
  prepare: <Printer size={14} aria-hidden="true" />,
  mesh: <Triangle size={14} aria-hidden="true" />,
  organize: <Layers size={14} aria-hidden="true" />,
  position: <Move3d size={14} aria-hidden="true" />,
  analyze: <ScanSearch size={14} aria-hidden="true" />,
};

export interface ActionGroupMenusProps {
  /** Cierra el menú y ejecuta la acción. */
  pick: (fn: () => void) => () => void;
  /** Marca el tipo actual del objeto en «Convertir en» (ítems de opción exclusiva). */
  currentRole?: ObjectRole;
  /** Ítems propios del contexto, al final de un grupo. */
  extras?: Partial<Record<ActionGroupId, React.ReactNode>>;
}

export const ActionGroupMenus: React.FC<ActionGroupMenusProps> = ({ pick, currentRole, extras }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const layout = useKuraStore((s) => s.layout);
  const printOnlyReason = plateToolBlockReason(layout);
  const state = { objects, selectedIds, groups, busyOperation, layout };

  const item = (id: ActionId) => {
    const availability = actionAvailability(state, id);
    const shortcut = ACTION_SHORTCUTS[id];
    const name = actionName(language, id);
    const reason = availability.reason ? t(language, availability.reason) : undefined;
    if (id === 'convert') {
      return (
        <SubMenu key={id} icon={ICONS[id]} label={name} tip={reason} disabled={!availability.enabled}>
          {OBJECT_ROLES.map((role) => (
            <MenuItem
              key={role}
              label={t(language, ROLE_LABEL_KEY[role])}
              checked={currentRole === undefined ? undefined : currentRole === role}
              checkedLabel={currentRole === undefined ? undefined : t(language, 'menu.type.current')}
              keys={currentRole === undefined || role === 'reference' ? undefined : 'H'}
              onSelect={pick(() => runConvert(role))}
            />
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
          <MenuItem
            label={t(language, 'inspector.pro.arrangeGrid')}
            disabled={Boolean(printOnlyReason)}
            tip={printOnlyReason ? t(language, printOnlyReason) : undefined}
            onSelect={pick(() => runAlign('arrange_grid'))}
          />
        </SubMenu>
      );
    }
    const tipKey = ACTION_TIP_KEY[id];
    const descKey = ACTION_DESCRIPTION_KEY[id];
    return (
      <MenuItem
        key={id}
        icon={ICONS[id]}
        label={name}
        tip={reason ? t(language, 'rediseno.reason.disabled', { reason }) : tipKey ? t(language, tipKey) : name}
        description={reason ?? (descKey ? t(language, descKey) : undefined)}
        shortcut={shortcut?.label.replace('Ctrl', MOD_LABEL)}
        keys={shortcut?.keys}
        disabled={!availability.enabled}
        onSelect={pick(() => runAction(id))}
      />
    );
  };

  return (
    <>
      {ACTION_GROUPS.map((group) => {
        const name = t(language, `rediseno.actions.group.${group.id}` as TranslationKey);
        return (
          <SubMenu key={group.id} icon={GROUP_ICONS[group.id]} label={name} tip={t(language, 'r3a.actions.groupTip', { name, count: group.items.length })}>
            {group.items.map((id) => item(id))}
            {extras?.[group.id]}
          </SubMenu>
        );
      })}
    </>
  );
};

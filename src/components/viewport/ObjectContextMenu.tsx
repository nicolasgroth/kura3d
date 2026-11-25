/**
 * @file src/components/viewport/ObjectContextMenu.tsx
 * @description Menú contextual (clic derecho) sobre un objeto del visor. El primer nivel es corto: Renombrar,
 * Duplicar, Ocultar, Bloquear, Agrupar, los cinco grupos del menú «Acciones» de la barra (mismos nombres y orden:
 * Preparar, Malla, Organizar, Posición, Analizar), «Más» y Eliminar. Agregar pieza, Reemplazar, Exportar, Repetir y
 * Atajos viven en «Más»; Corte por plano en Preparar y Transformar en Posición. Cada acción cierra el menú antes de
 * ejecutarse. La estructura y el teclado viven en `contextMenu/MenuKit`; los grupos, en `shell/ActionGroupMenus`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Copy, Eye, EyeOff, Group, Lock, Scissors, PencilLine, Trash2, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { ACTION_TIP_KEY, actionName } from '../../store/actionLabels';
import { actionAvailability } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { type ContextMenuState } from './viewportHelpers';
import { type SceneObject } from '../../types/kura';
import { MenuItem, MenuSurface } from './contextMenu/MenuKit';
import { ObjectMenuMore } from './contextMenu/ObjectMenuMore';
import { TransformSubMenu } from './contextMenu/ObjectMenuPosition';
import { MoveToPlateMenu } from './contextMenu/MoveToPlateMenu';
import { confirmDeleteSelection } from '../scene/confirmDeleteSelection';
import { ActionGroupMenus } from '../shell/ActionGroupMenus';
import { runAction } from '../shell/actionRunners';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

/** Menú contextual sobre un objeto 3D; cada acción cierra el menú antes de ejecutarse. */
export const ObjectContextMenu: React.FC<{ menu: ContextMenuState; target: SceneObject; onClose: () => void }> = ({ menu, target, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const requestRename = useKuraStore((s) => s.requestRename);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const setSelection = useKuraStore((s) => s.setSelection);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const typeIds = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const picked = objects.filter((o) => typeIds.includes(o.id));
  // Con varios objetos el encabezado dice cuántos, no el nombre de uno de ellos.
  const menuTitle = typeIds.length > 1 ? t(language, 'ux7.menu.objects', { count: typeIds.length }) : target.name;
  const allLocked = picked.every((o) => o.locked);
  const groupAvailability = actionAvailability({ objects, selectedIds: typeIds, groups, busyOperation }, 'group');
  const groupReason = groupAvailability.reason ? t(language, groupAvailability.reason) : undefined;

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  /** Las acciones del catálogo operan sobre la selección: el objeto del menú va primero. */
  const pick = (fn: () => void) =>
    run(() => {
      if (selectedIds[0] !== target.id) setSelection([target.id, ...selectedIds.filter((id) => id !== target.id)]);
      fn();
    });

  return (
    <MenuSurface x={menu.x} y={menu.y} label={t(language, 'menu.label', { name: menuTitle })} title={menuTitle}>
      <MenuItem icon={<PencilLine size={14} aria-hidden="true" />} label={t(language, 'menu.rename')} shortcut="F2" keys="F2" disabled={target.locked} onSelect={run(() => void requestRename(target.id))} />
      <MenuItem icon={<Copy size={14} aria-hidden="true" />} label={t(language, 'ctx.duplicate')} shortcut={`${MOD}+D`} keys="Control+D" onSelect={run(() => duplicateObjects([target.id]))} />
      <MenuItem
        icon={target.visible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        label={t(language, target.visible ? 'menu.more.hide' : 'ux8.menu.show')}
        tip={t(language, target.visible ? 'menu.more.hide.tip' : 'ux8.menu.show.tip')}
        onSelect={run(() => typeIds.forEach((id) => updateObjectMeta(id, { visible: !target.visible })))}
      />
      <MenuItem
        icon={allLocked ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
        label={t(language, allLocked ? 'ux8.menu.unlock' : 'ux8.menu.lock')}
        tip={t(language, allLocked ? 'ux8.menu.unlock.tip' : 'ux8.menu.lock.tip')}
        onSelect={run(() => typeIds.forEach((id) => updateObjectMeta(id, { locked: !allLocked })))}
      />
      <MenuItem
        icon={<Group size={14} aria-hidden="true" />}
        label={actionName(language, 'group')}
        tip={groupReason ? t(language, 'rediseno.reason.disabled', { reason: groupReason }) : t(language, ACTION_TIP_KEY.group!)}
        shortcut={`${MOD}+G`}
        keys="Control+G Meta+G"
        disabled={!groupAvailability.enabled}
        onSelect={pick(() => runAction('group'))}
      />
      {/* Primer nivel (solo desde la segunda placa): «Mover a placa» no se esconde tres niveles adentro. */}
      <MoveToPlateMenu target={target} run={run} />

      <div className="kura-context-sep" role="separator" />
      <ActionGroupMenus
        pick={pick}
        currentRole={target.role}
        extras={{
          prepare: (
            <MenuItem icon={<Scissors size={14} aria-hidden="true" />} label={t(language, 'ctx.planeCut')} disabled={target.locked} keys="C" onSelect={run(() => setActiveDialog('cut'))} />
          ),
          position: <TransformSubMenu target={target} run={run} />,
        }}
      />
      <ObjectMenuMore target={target} run={run} />

      <div className="kura-context-sep" role="separator" />
      <MenuItem icon={<Trash2 size={14} aria-hidden="true" />} label={t(language, 'ctx.delete')} shortcut="Del" keys="Delete" danger disabled={target.locked} onSelect={run(() => void confirmDeleteSelection(typeIds))} />
    </MenuSurface>
  );
};

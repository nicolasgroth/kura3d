/**
 * @file src/components/viewport/ObjectContextMenu.tsx
 * @description Menú contextual (clic derecho) sobre un objeto del visor, ordenado como en los laminadores:
 * Agregar (pieza / pieza negativa), Tipo, Geometría, Posición, Organizar, Analizar, Objeto y Ayuda. Cada acción cierra el menú
 * antes de ejecutarse. La estructura y el teclado viven en `contextMenu/MenuKit`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isNegative, isSolid, OBJECT_ROLES } from '../../core/scene/objectRole';
import { ROLE_LABEL_KEY } from '../../store/roleLabels';
import React from 'react';
import {
  Box,
  Combine,
  Copy,
  HelpCircle,
  MinusCircle,
  PaintBucket,
  PencilLine,
  PlusCircle,
  Repeat2,
  RefreshCw,
  ScanSearch,
  Minimize2,
  Scissors,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Type,
  Wrench,
} from 'lucide-react';
import { t } from '../../i18n';
import { parametricStateOf } from '../../core/scene/parametric';
import { useKuraStore } from '../../store/useKuraStore';
import { repeatLabel } from '../../store/repeatLabel';
import { isTauriRuntime } from '../../utils/platformBridge';
import { type ContextMenuState } from './viewportHelpers';
import { type SceneObject } from '../../types/kura';
import { MenuGroup, MenuItem, MenuSurface, SubMenu } from './contextMenu/MenuKit';
import { PieceShapeItems } from './contextMenu/PieceShapeItems';
import { ObjectMenuMore } from './contextMenu/ObjectMenuMore';
import { ObjectMenuPosition } from './contextMenu/ObjectMenuPosition';
import { ObjectMenuOrganize } from './contextMenu/ObjectMenuOrganize';
import { confirmDeleteSelection } from '../scene/confirmDeleteSelection';
import { openHollowPanel } from '../inspector/hollowPanelRequest';
import { openActionPanel } from '../shell/actionRunners';
import { FitCheckMenuItem } from '../fitCheck/FitCheckMenuItem';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

/** Menú contextual sobre un objeto 3D; cada acción cierra el menú antes de ejecutarse. */
export const ObjectContextMenu: React.FC<{ menu: ContextMenuState; target: SceneObject; onClose: () => void }> = ({ menu, target, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const addPieceToObject = useKuraStore((s) => s.addPieceToObject);
  const setObjectsRole = useKuraStore((s) => s.setObjectsRole);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const repairObjectMesh = useKuraStore((s) => s.repairObjectMesh);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const requestRename = useKuraStore((s) => s.requestRename);
  const recomputeSelected = useKuraStore((s) => s.recomputeSelected);
  const repeatLastAction = useKuraStore((s) => s.repeatLastAction);
  const addToast = useKuraStore((s) => s.addToast);
  const openFitToBed = useKuraStore((s) => s.openFitToBed);
  const holeCount = objects.filter((o) => isNegative(o) && o.visible).length;
  const solidCount = objects.filter((o) => isSolid(o) && o.visible).length;
  const typeIds = selectedIds.includes(target.id) ? selectedIds : [target.id];
  // Con varios objetos el encabezado dice cuántos, no el nombre de uno de ellos.
  const menuTitle = typeIds.length > 1 ? t(language, 'ux7.menu.objects', { count: typeIds.length }) : target.name;
  const isParametric = ['primitive', 'thread'].includes(parametricStateOf(target).status);
  // F5 recarga la página en el navegador: solo se anuncia como atajo en escritorio.
  const recomputeKey = isTauriRuntime() ? 'F5' : 'Shift+F5';
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <MenuSurface x={menu.x} y={menu.y} label={t(language, 'menu.label', { name: menuTitle })} title={menuTitle}>
      <MenuGroup title={t(language, 'menu.group.add')}>
        <SubMenu icon={<PlusCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-green)' }} />} label={t(language, 'menu.addPart')} tip={t(language, 'menu.addPart.tip')}>
          <PieceShapeItems language={language} onPick={(shape) => run(() => void addPieceToObject(shape, 'positive', target.id))()} />
        </SubMenu>
        <SubMenu icon={<MinusCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-amber)' }} />} label={t(language, 'menu.addNegative')} tip={t(language, 'menu.addNegative.tip')}>
          <PieceShapeItems language={language} onPick={(shape) => run(() => void addPieceToObject(shape, 'negative', target.id))()} />
        </SubMenu>
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.type')}>
        <SubMenu icon={<ToggleLeft size={14} aria-hidden="true" />} label={t(language, 'menu.changeType')} tip={t(language, 'menu.changeType.tip')}>
          {OBJECT_ROLES.map((role) => (
            <MenuItem
              key={role}
              label={t(language, ROLE_LABEL_KEY[role])}
              checked={target.role === role}
              checkedLabel={t(language, 'menu.type.current')}
              keys={role === 'reference' ? undefined : 'H'}
              onSelect={run(() => setObjectsRole(typeIds, role))}
            />
          ))}
        </SubMenu>
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.geometry')}>
        <MenuItem icon={<Box size={14} aria-hidden="true" />} label={t(language, 'ctx.hollowOpen')} tip={t(language, 'ctx.hollowOpenTip')} disabled={target.locked} onSelect={run(() => openHollowPanel(target.id))} />
        <MenuItem icon={<Scissors size={14} aria-hidden="true" />} label={t(language, 'ctx.planeCut')} disabled={target.locked} keys="C" onSelect={run(() => setActiveDialog('cut'))} />
        <MenuItem icon={<Minimize2 size={14} aria-hidden="true" />} label={t(language, 'fit.open')} tip={t(language, 'fit.openTip')} disabled={target.locked} onSelect={run(() => void openFitToBed(typeIds))} />
        <MenuItem icon={<PaintBucket size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.generateMold')} keys="Shift+M" onSelect={run(() => setActiveDialog('mold'))} />
        <MenuItem icon={<Type size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.projectSurface')} disabled={target.locked} onSelect={run(() => setActiveDialog('project'))} />
        {holeCount > 0 && solidCount > 0 && (
          <MenuItem icon={<Combine size={14} aria-hidden="true" />} label={t(language, 'ctx.applyHoles')} accent onSelect={run(() => void applyHolesOnSolids())} />
        )}
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <ObjectMenuOrganize target={target} run={run} />

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.position')}>
        <ObjectMenuPosition target={target} run={run} />
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.analyze')}>
        <MenuItem icon={<ShieldCheck size={14} aria-hidden="true" style={{ color: 'var(--accent-green)' }} />} label={t(language, 'ctx.validatePrint')} onSelect={run(() => { void runPrintabilityCheck(target.id); openActionPanel('validate'); })} />
        <MenuItem icon={<ScanSearch size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.detectStructures')} onSelect={run(() => { void detectObjectStructures(target.id); openActionPanel('detect'); })} />
        <FitCheckMenuItem run={run} />
        <MenuItem icon={<Wrench size={14} aria-hidden="true" />} label={t(language, 'repair.action')} tip={t(language, 'repair.actionTip')} disabled={target.locked} onSelect={run(() => void repairObjectMesh(target.id))} />
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.object')}>
        <MenuItem icon={<PencilLine size={14} aria-hidden="true" />} label={t(language, 'menu.rename')} shortcut="F2" keys="F2" disabled={target.locked} onSelect={run(() => void requestRename(target.id))} />
        <MenuItem icon={<Copy size={14} aria-hidden="true" />} label={t(language, 'ctx.duplicate')} shortcut={`${MOD}+D`} keys="Control+D" onSelect={run(() => duplicateObjects([target.id]))} />
        {isParametric && (
          <MenuItem
            icon={<RefreshCw size={14} aria-hidden="true" />}
            label={t(language, 'menu.recompute')}
            tip={t(language, 'menu.recompute.tip')}
            shortcut={recomputeKey}
            keys={`${recomputeKey} Shift+F5`}
            disabled={target.locked}
            onSelect={run(() => void recomputeSelected().then((n) => addToast(n > 0 ? t(language, 'menu.recompute.done', { count: n }) : t(language, 'menu.recompute.none'), n > 0 ? 'success' : 'info')))}
          />
        )}
        {lastRepeatable && (
          <MenuItem
            icon={<Repeat2 size={14} aria-hidden="true" />}
            label={t(language, 'repeat.label', { name: repeatLabel(language, lastRepeatable) })}
            tip={t(language, 'repeat.tip')}
            shortcut="F4"
            keys="F4"
            onSelect={run(() => void repeatLastAction())}
          />
        )}
        <ObjectMenuMore target={target} run={run} />
        <MenuItem icon={<Trash2 size={14} aria-hidden="true" />} label={t(language, 'ctx.delete')} shortcut="Del" keys="Delete" danger disabled={target.locked} onSelect={run(() => void confirmDeleteSelection(selectedIds.includes(target.id) ? selectedIds : [target.id]))} />
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.help')}>
        <MenuItem icon={<HelpCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.shortcuts')} shortcut="?" keys="F1" onSelect={run(() => setActiveDialog('shortcuts'))} />
      </MenuGroup>
    </MenuSurface>
  );
};

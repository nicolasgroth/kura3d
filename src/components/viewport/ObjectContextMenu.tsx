/**
 * @file src/components/viewport/ObjectContextMenu.tsx
 * @description Menú contextual (clic derecho) sobre un objeto del visor, ordenado como en los laminadores:
 * Agregar (pieza / pieza negativa), Tipo, Geometría, Analizar, Objeto y Ayuda. Cada acción cierra el menú
 * antes de ejecutarse. La estructura y el teclado viven en `contextMenu/MenuKit`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import {
  ArrowDownToLine,
  Box,
  Combine,
  Copy,
  FlipHorizontal2,
  HelpCircle,
  MinusCircle,
  PaintBucket,
  PencilLine,
  PlusCircle,
  Repeat2,
  RefreshCw,
  ScanSearch,
  Scissors,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Type,
} from 'lucide-react';
import { t } from '../../i18n';
import { userAxisLabel } from '../../core/scene/displayAxes';
import { parametricStateOf } from '../../core/scene/parametric';
import { useKuraStore } from '../../store/useKuraStore';
import { repeatLabel } from '../../store/repeatLabel';
import { isTauriRuntime } from '../../utils/platformBridge';
import { type ContextMenuState } from './viewportHelpers';
import { type SceneObject } from '../../types/kura';
import { MenuGroup, MenuItem, MenuSurface, SubMenu } from './contextMenu/MenuKit';
import { PieceShapeItems } from './contextMenu/PieceShapeItems';
import { openHollowPanel } from '../inspector/hollowPanelRequest';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

/** Ejes del usuario (Z = altura) con su eje interno del motor. */
const MIRROR_AXES = [
  { internal: 'x', user: 'x' },
  { internal: 'z', user: 'y' },
  { internal: 'y', user: 'z' },
] as const;

/** Menú contextual sobre un objeto 3D; cada acción cierra el menú antes de ejecutarse. */
export const ObjectContextMenu: React.FC<{ menu: ContextMenuState; target: SceneObject; onClose: () => void }> = ({ menu, target, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const addPieceToObject = useKuraStore((s) => s.addPieceToObject);
  const setObjectsHole = useKuraStore((s) => s.setObjectsHole);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const deleteObjects = useKuraStore((s) => s.deleteObjects);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const requestRename = useKuraStore((s) => s.requestRename);
  const recomputeSelected = useKuraStore((s) => s.recomputeSelected);
  const repeatLastAction = useKuraStore((s) => s.repeatLastAction);
  const addToast = useKuraStore((s) => s.addToast);
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;
  const typeIds = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const isParametric = ['primitive', 'thread'].includes(parametricStateOf(target).status);
  // F5 recarga la página en el navegador: solo se anuncia como atajo en escritorio.
  const recomputeKey = isTauriRuntime() ? 'F5' : 'Shift+F5';
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <MenuSurface x={menu.x} y={menu.y} label={t(language, 'menu.label', { name: target.name })} title={target.name}>
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
          <MenuItem
            label={t(language, 'menu.type.solid')}
            checked={!target.isHole}
            checkedLabel={t(language, 'menu.type.current')}
            keys="H"
            onSelect={run(() => setObjectsHole(typeIds, false))}
          />
          <MenuItem
            label={t(language, 'menu.type.negative')}
            checked={target.isHole}
            checkedLabel={t(language, 'menu.type.current')}
            keys="H"
            onSelect={run(() => setObjectsHole(typeIds, true))}
          />
        </SubMenu>
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.geometry')}>
        <MenuItem icon={<Box size={14} aria-hidden="true" />} label={t(language, 'ctx.hollowOpen')} tip={t(language, 'ctx.hollowOpenTip')} disabled={target.locked} onSelect={run(() => openHollowPanel(target.id))} />
        <MenuItem icon={<Scissors size={14} aria-hidden="true" />} label={t(language, 'ctx.planeCut')} disabled={target.locked} keys="C" onSelect={run(() => setActiveDialog('cut'))} />
        <MenuItem icon={<PaintBucket size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.generateMold')} keys="Shift+M" onSelect={run(() => setActiveDialog('mold'))} />
        <MenuItem icon={<Type size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.projectSurface')} disabled={target.locked} onSelect={run(() => setActiveDialog('project'))} />
        <SubMenu icon={<FlipHorizontal2 size={14} aria-hidden="true" />} label={t(language, 'menu.mirror')} disabled={target.locked}>
          {MIRROR_AXES.map(({ internal, user }) => (
            <MenuItem key={user} label={t(language, 'menu.mirror.axis', { axis: userAxisLabel(internal) })} onSelect={run(() => mirrorObject(target.id, internal))} />
          ))}
        </SubMenu>
        {holeCount > 0 && solidCount > 0 && (
          <MenuItem icon={<Combine size={14} aria-hidden="true" />} label={t(language, 'ctx.applyHoles')} accent onSelect={run(() => void applyHolesOnSolids())} />
        )}
        {selectedIds.length >= 2 && (
          <MenuItem icon={<Combine size={14} aria-hidden="true" />} label={t(language, 'ctx.unionSelection')} onSelect={run(() => void runBooleanOnSelection('union'))} />
        )}
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.analyze')}>
        <MenuItem icon={<ShieldCheck size={14} aria-hidden="true" style={{ color: 'var(--accent-green)' }} />} label={t(language, 'ctx.validatePrint')} onSelect={run(() => void runPrintabilityCheck(target.id))} />
        <MenuItem icon={<ScanSearch size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.detectStructures')} onSelect={run(() => void detectObjectStructures(target.id))} />
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.object')}>
        <MenuItem icon={<PencilLine size={14} aria-hidden="true" />} label={t(language, 'menu.rename')} shortcut="F2" keys="F2" disabled={target.locked} onSelect={run(() => void requestRename(target.id))} />
        <MenuItem icon={<Copy size={14} aria-hidden="true" />} label={t(language, 'ctx.duplicate')} shortcut={`${MOD}+D`} keys="Control+D" onSelect={run(() => duplicateObjects([target.id]))} />
        <MenuItem icon={<ArrowDownToLine size={14} aria-hidden="true" />} label={t(language, 'ctx.dropToBed')} keys="L" disabled={target.locked} onSelect={run(() => dropObjectToBed(target.id))} />
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
        <MenuItem icon={<Trash2 size={14} aria-hidden="true" />} label={t(language, 'ctx.delete')} shortcut="Del" keys="Delete" danger disabled={target.locked} onSelect={run(() => deleteObjects([target.id]))} />
      </MenuGroup>

      <div className="kura-context-sep" role="separator" />
      <MenuGroup title={t(language, 'menu.group.help')}>
        <MenuItem icon={<HelpCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.shortcuts')} shortcut="?" keys="F1" onSelect={run(() => setActiveDialog('shortcuts'))} />
      </MenuGroup>
    </MenuSurface>
  );
};

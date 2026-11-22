/**
 * @file src/components/viewport/ObjectContextMenu.tsx
 * @description Menú contextual (clic derecho) sobre un objeto del visor.
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
  FileUp,
  FlipHorizontal2,
  HelpCircle,
  MinusCircle,
  PaintBucket,
  ScanSearch,
  Scissors,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Type,
} from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { type ContextMenuState } from './viewportHelpers';
import { type SceneObject } from '../../types/kura';

/** Menú contextual sobre un objeto 3D; cada acción cierra el menú antes de ejecutarse. */
export const ObjectContextMenu: React.FC<{ menu: ContextMenuState; target: SceneObject; onClose: () => void }> = ({ menu, target, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const addSubtractHelperPrimitive = useKuraStore((s) => s.addSubtractHelperPrimitive);
  const importModelAsModuleFromDialog = useKuraStore((s) => s.importModelAsModuleFromDialog);
  const applyHolesOnSolids = useKuraStore((s) => s.applyHolesOnSolids);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const hollowObject = useKuraStore((s) => s.hollowObject);
  const runPrintabilityCheck = useKuraStore((s) => s.runPrintabilityCheck);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const deleteObjects = useKuraStore((s) => s.deleteObjects);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const detectObjectStructures = useKuraStore((s) => s.detectObjectStructures);
  const holeCount = objects.filter((o) => o.isHole && o.visible).length;
  const solidCount = objects.filter((o) => !o.isHole && o.visible).length;

  return (
    <div
      className="kura-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
    >
      <div className="kura-context-header">{target.name}</div>

      <button
        type="button"
        className="kura-context-item"
        title={t(language, 'inspector.op.subtractSphereTip')}
        onClick={() => {
          onClose();
          void addSubtractHelperPrimitive('sphere', target.id);
        }}
      >
        <MinusCircle size={14} style={{ color: 'var(--accent-amber)' }} />
        <span>{t(language, 'ctx.subtractSphere')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        title={t(language, 'inspector.op.subtractCylinderTip')}
        onClick={() => {
          onClose();
          void addSubtractHelperPrimitive('cylinder', target.id);
        }}
      >
        <MinusCircle size={14} style={{ color: 'var(--accent-amber)' }} />
        <span>{t(language, 'ctx.subtractCylinder')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          void importModelAsModuleFromDialog('negative', target.id);
        }}
      >
        <FileUp size={14} style={{ color: 'var(--accent-amber)' }} />
        <span>{t(language, 'ctx.importModuleSub')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          updateObjectMeta(target.id, { isHole: !target.isHole });
        }}
      >
        <ToggleLeft size={14} />
        <span>{t(language, 'ctx.toggleHole')}</span>
      </button>

      {holeCount > 0 && solidCount > 0 && (
        <button
          type="button"
          className="kura-context-item is-accent"
          onClick={() => {
            onClose();
            void applyHolesOnSolids();
          }}
        >
          <Combine size={14} />
          <span>{t(language, 'ctx.applyHoles')}</span>
        </button>
      )}

      {selectedIds.length >= 2 && (
        <button
          type="button"
          className="kura-context-item"
          onClick={() => {
            onClose();
            void runBooleanOnSelection('union');
          }}
        >
          <Combine size={14} />
          <span>{t(language, 'ctx.unionSelection')}</span>
        </button>
      )}

      <div className="kura-context-sep" />

      <button
        type="button"
        className="kura-context-item"
        disabled={target.locked}
        onClick={() => {
          onClose();
          void hollowObject(target.id, { enabled: true, wallThickness: 2.2 });
        }}
      >
        <Box size={14} />
        <span>{t(language, 'ctx.hollow')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        disabled={target.locked}
        onClick={() => {
          onClose();
          setActiveDialog('cut');
        }}
      >
        <Scissors size={14} />
        <span>{t(language, 'ctx.planeCut')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          setActiveDialog('mold');
        }}
      >
        <PaintBucket size={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>{t(language, 'ctx.generateMold')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        disabled={target.locked}
        onClick={() => {
          onClose();
          setActiveDialog('project');
        }}
      >
        <Type size={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>{t(language, 'ctx.projectSurface')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          runPrintabilityCheck(target.id);
        }}
      >
        <ShieldCheck size={14} style={{ color: 'var(--accent-green)' }} />
        <span>{t(language, 'ctx.validatePrint')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          void detectObjectStructures(target.id);
        }}
      >
        <ScanSearch size={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>{t(language, 'ctx.detectStructures')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        disabled={target.locked}
        onClick={() => {
          onClose();
          mirrorObject(target.id, 'x');
        }}
      >
        <FlipHorizontal2 size={14} />
        <span>{t(language, 'ctx.mirrorX')}</span>
      </button>

      <div className="kura-context-sep" />

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          duplicateObjects([target.id]);
        }}
      >
        <Copy size={14} />
        <span>{t(language, 'ctx.duplicate')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item"
        disabled={target.locked}
        onClick={() => {
          onClose();
          dropObjectToBed(target.id);
        }}
      >
        <ArrowDownToLine size={14} />
        <span>{t(language, 'ctx.dropToBed')}</span>
      </button>

      <button
        type="button"
        className="kura-context-item is-danger"
        disabled={target.locked}
        onClick={() => {
          onClose();
          deleteObjects([target.id]);
        }}
      >
        <Trash2 size={14} />
        <span>{t(language, 'ctx.delete')}</span>
      </button>

      <div className="kura-context-sep" />

      <button
        type="button"
        className="kura-context-item"
        onClick={() => {
          onClose();
          setActiveDialog('shortcuts');
        }}
      >
        <HelpCircle size={14} style={{ color: 'var(--accent-cyan)' }} />
        <span>{t(language, 'ctx.shortcuts')}</span>
      </button>
    </div>
  );
};

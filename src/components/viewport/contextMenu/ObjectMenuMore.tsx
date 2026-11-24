/**
 * @file src/components/viewport/contextMenu/ObjectMenuMore.tsx
 * @description Submenú «Más» del menú contextual del objeto: lo que no tiene sitio en el primer nivel ni en los
 * grupos del catálogo de acciones. Agregar pieza y pieza negativa (con sus formas), Reemplazar por archivo…,
 * Exportar selección como un STL…, Repetir la última acción, Recalcular (solo objetos paramétricos) y Atajos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isPrintable } from '../../../core/scene/objectRole';
import { parametricStateOf } from '../../../core/scene/parametric';
import React from 'react';
import { Download, FileInput, HelpCircle, MinusCircle, MoreHorizontal, PlusCircle, RefreshCw, Repeat2 } from 'lucide-react';
import { t } from '../../../i18n';
import { useKuraStore } from '../../../store/useKuraStore';
import { repeatLabel } from '../../../store/repeatLabel';
import { isTauriRuntime } from '../../../utils/platformBridge';
import type { SceneObject } from '../../../types/kura';
import { openExportDialog } from '../../ExportDialog';
import { MenuItem, SubMenu } from './MenuKit';
import { PieceShapeItems } from './PieceShapeItems';

export const ObjectMenuMore: React.FC<{
  target: SceneObject;
  run: (fn: () => void) => () => void;
}> = ({ target, run }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busy = useKuraStore((s) => Boolean(s.busyOperation || s.projectBusy));
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const replaceObjectMeshFromDialog = useKuraStore((s) => s.replaceObjectMeshFromDialog);
  const addPieceToObject = useKuraStore((s) => s.addPieceToObject);
  const setSelection = useKuraStore((s) => s.setSelection);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const recomputeSelected = useKuraStore((s) => s.recomputeSelected);
  const repeatLastAction = useKuraStore((s) => s.repeatLastAction);
  const addToast = useKuraStore((s) => s.addToast);
  const ids = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const hasExportable = objects.some((o) => ids.includes(o.id) && isPrintable(o));
  const isParametric = ['primitive', 'thread'].includes(parametricStateOf(target).status);
  // F5 recarga la página en el navegador: solo se anuncia como atajo en escritorio.
  const recomputeKey = isTauriRuntime() ? 'F5' : 'Shift+F5';

  return (
    <SubMenu icon={<MoreHorizontal size={14} aria-hidden="true" />} label={t(language, 'menu.more')} tip={t(language, 'menu.more.tip')}>
      <SubMenu icon={<PlusCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-green)' }} />} label={t(language, 'menu.addPart')} tip={t(language, 'menu.addPart.tip')}>
        <PieceShapeItems language={language} onPick={(shape) => run(() => void addPieceToObject(shape, 'positive', target.id))()} />
      </SubMenu>
      <SubMenu icon={<MinusCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-amber)' }} />} label={t(language, 'menu.addNegative')} tip={t(language, 'menu.addNegative.tip')}>
        <PieceShapeItems language={language} onPick={(shape) => run(() => void addPieceToObject(shape, 'negative', target.id))()} />
      </SubMenu>
      <MenuItem
        icon={<FileInput size={14} aria-hidden="true" />}
        label={t(language, 'menu.more.replace')}
        tip={t(language, 'menu.more.replace.tip')}
        disabled={target.locked || busy}
        onSelect={run(() => void replaceObjectMeshFromDialog(target.id))}
      />
      <MenuItem
        icon={<Download size={14} aria-hidden="true" />}
        label={t(language, 'menu.more.exportStl')}
        tip={hasExportable ? t(language, 'menu.more.exportStl.tip') : t(language, 'menu.more.exportStl.none')}
        disabled={!hasExportable}
        onSelect={run(() => {
          if (!selectedIds.includes(target.id)) setSelection([target.id]);
          openExportDialog('stl', 'selection');
        })}
      />
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
      <MenuItem icon={<HelpCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-cyan)' }} />} label={t(language, 'ctx.shortcuts')} shortcut="?" keys="F1" onSelect={run(() => setActiveDialog('shortcuts'))} />
    </SubMenu>
  );
};

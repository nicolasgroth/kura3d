/**
 * @file src/components/viewport/contextMenu/ObjectMenuMore.tsx
 * @description Submenú "Más" del menú contextual del objeto: Reemplazar por archivo…, Exportar selección como un STL…
 * (abre el diálogo de exportación con alcance «selección» y formato STL) y Ocultar (un objeto oculto no se exporta).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isPrintable } from '../../../core/scene/objectRole';
import React from 'react';
import { Download, EyeOff, FileInput, MoreHorizontal } from 'lucide-react';
import { t } from '../../../i18n';
import { useKuraStore } from '../../../store/useKuraStore';
import type { SceneObject } from '../../../types/kura';
import { openExportDialog } from '../../ExportDialog';
import { MenuItem, SubMenu } from './MenuKit';

export const ObjectMenuMore: React.FC<{
  target: SceneObject;
  run: (fn: () => void) => () => void;
}> = ({ target, run }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busy = useKuraStore((s) => Boolean(s.busyOperation || s.projectBusy));
  const replaceObjectMeshFromDialog = useKuraStore((s) => s.replaceObjectMeshFromDialog);
  const setSelection = useKuraStore((s) => s.setSelection);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const ids = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const hasExportable = objects.some((o) => ids.includes(o.id) && isPrintable(o));

  return (
    <SubMenu icon={<MoreHorizontal size={14} aria-hidden="true" />} label={t(language, 'menu.more')} tip={t(language, 'menu.more.tip')}>
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
      <MenuItem
        icon={<EyeOff size={14} aria-hidden="true" />}
        label={t(language, 'menu.more.hide')}
        tip={t(language, 'menu.more.hide.tip')}
        onSelect={run(() => ids.forEach((id) => updateObjectMeta(id, { visible: false })))}
      />
    </SubMenu>
  );
};

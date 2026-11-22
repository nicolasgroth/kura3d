/**
 * @file src/components/viewport/contextMenu/ObjectMenuOrganize.tsx
 * @description Grupo «Organizar» del menú contextual del objeto: Agrupar (Ctrl/⌘+G), Desagrupar
 * (Ctrl/⌘+Mayús+G), Combinar en un objeto, Separar cuerpos y Unir (booleana), con una línea de ayuda
 * que distingue las tres formas de juntar objetos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Boxes, Combine, Group, Merge, Ungroup } from 'lucide-react';
import { t } from '../../../i18n';
import { selectedGroup } from '../../../core/scene/groups';
import { useKuraStore } from '../../../store/useKuraStore';
import type { SceneObject } from '../../../types/kura';
import { MenuGroup, MenuItem } from './MenuKit';
import '../../../styles/sceneTree.css';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '') ? '⌘' : 'Ctrl';

export const ObjectMenuOrganize: React.FC<{
  target: SceneObject;
  run: (fn: () => void) => () => void;
}> = ({ target, run }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const busy = useKuraStore((s) => Boolean(s.busyOperation));
  const groupObjects = useKuraStore((s) => s.groupObjects);
  const ungroupObjects = useKuraStore((s) => s.ungroupObjects);
  const combineObjects = useKuraStore((s) => s.combineObjects);
  const separateBodies = useKuraStore((s) => s.separateBodies);
  const runBooleanOnSelection = useKuraStore((s) => s.runBooleanOnSelection);
  const ids = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const picked = objects.filter((o) => ids.includes(o.id));
  const anyLocked = picked.some((o) => o.locked);
  const inGroup = Boolean(selectedGroup(objects, groups, ids)) || picked.some((o) => o.groupRef);

  return (
    <MenuGroup title={t(language, 'menu.group.organize')}>
      <p className="kura-context-help">{t(language, 'groups.menu.help')}</p>
      <MenuItem
        icon={<Group size={14} aria-hidden="true" />}
        label={t(language, 'groups.action.group')}
        tip={t(language, anyLocked ? 'groups.toast.locked' : ids.length < 2 ? 'groups.toast.needTwo' : 'groups.action.group.tip')}
        shortcut={`${MOD}+G`}
        keys="Control+G Meta+G"
        disabled={anyLocked || ids.length < 2}
        onSelect={run(() => void groupObjects(ids))}
      />
      <MenuItem
        icon={<Ungroup size={14} aria-hidden="true" />}
        label={t(language, 'groups.action.ungroup')}
        tip={t(language, inGroup && anyLocked ? 'groups.toast.lockedUngroup' : 'groups.action.ungroup.tip')}
        shortcut={`${MOD}+Shift+G`}
        keys="Control+Shift+G Meta+Shift+G"
        disabled={!inGroup || anyLocked}
        onSelect={run(() => void ungroupObjects())}
      />
      <MenuItem
        icon={<Boxes size={14} aria-hidden="true" />}
        label={t(language, 'groups.action.combine')}
        tip={t(language, 'groups.action.combine.tip')}
        disabled={ids.length < 2 || anyLocked || busy}
        onSelect={run(() => void combineObjects(ids))}
      />
      <MenuItem
        icon={<Merge size={14} aria-hidden="true" />}
        label={t(language, 'groups.action.separate')}
        tip={t(language, 'groups.action.separate.tip')}
        disabled={target.locked || busy}
        onSelect={run(() => void separateBodies(target.id))}
      />
      <MenuItem
        icon={<Combine size={14} aria-hidden="true" />}
        label={t(language, 'ctx.unionSelection')}
        tip={t(language, 'groups.action.union.tip')}
        disabled={ids.length < 2 || busy}
        onSelect={run(() => {
          if (!selectedIds.includes(target.id)) useKuraStore.getState().setSelection(ids);
          void runBooleanOnSelection('union');
        })}
      />
    </MenuGroup>
  );
};

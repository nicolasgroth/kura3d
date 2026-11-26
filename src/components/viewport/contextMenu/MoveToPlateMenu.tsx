/**
 * @file src/components/viewport/contextMenu/MoveToPlateMenu.tsx
 * @description Submenú «Mover a placa ›» del grupo Posición del menú contextual del objeto: lista las placas (la actual
 * de la pieza queda apagada) y «Placa nueva». Solo existe desde la segunda placa; con una o ninguna no pinta nada y el
 * menú es el de siempre. Mover es un solo paso de deshacer (`moveToPlate` del store).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Layers, Plus } from 'lucide-react';
import { assignable } from '../../../core/scene/plates';
import { t } from '../../../i18n';
import { plateToolBlockReason } from '../../../core/scene/viewMode';
import { moveToPlateName } from '../../../store/actionLabels';
import { useKuraStore } from '../../../store/useKuraStore';
import type { SceneObject } from '../../../types/kura';
import { runMoveToPlate } from '../../shell/actionRunners';
import { MenuItem, SubMenu } from './MenuKit';

export const MoveToPlateMenu: React.FC<{
  target: SceneObject;
  /** Cierra el menú y ejecuta la acción. */
  run: (fn: () => void) => () => void;
}> = ({ target, run }) => {
  const language = useKuraStore((s) => s.language);
  const plates = useKuraStore((s) => s.plates);
  const layout = useKuraStore((s) => s.layout);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setSelection = useKuraStore((s) => s.setSelection);
  if (plates.length < 2) return null;
  const ids = selectedIds.includes(target.id) ? selectedIds : [target.id];
  const movable = objects.filter((o) => ids.includes(o.id) && assignable(o));
  const printOnlyReason = plateToolBlockReason(layout);
  const available = movable.length > 0 && !printOnlyReason;
  /** Mueve lo elegido en el menú (si el objeto no estaba seleccionado, pasa a ser la selección). */
  const move = (plateId: string | null) => run(() => {
    if (!selectedIds.includes(target.id)) setSelection([target.id]);
    runMoveToPlate(plateId);
  });
  const tip = printOnlyReason ? t(language, printOnlyReason) : available ? t(language, 'plates.action.moveToPlate.tip') : t(language, 'plates.move.reason');
  return (
    <SubMenu icon={<Layers size={14} aria-hidden="true" />} label={moveToPlateName(language)} tip={tip} disabled={!available}>
      {plates.map((p) => {
        const here = movable.every((o) => o.plateRef === p.id);
        return <MenuItem key={p.id} label={here ? t(language, 'plates.move.current', { name: p.name }) : p.name} disabled={here} onSelect={move(p.id)} />;
      })}
      <div className="kura-context-sep" role="separator" />
      <MenuItem icon={<Plus size={14} aria-hidden="true" />} label={t(language, 'plates.move.new')} onSelect={move(null)} />
    </SubMenu>
  );
};

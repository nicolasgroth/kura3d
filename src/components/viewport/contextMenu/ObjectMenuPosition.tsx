/**
 * @file src/components/viewport/contextMenu/ObjectMenuPosition.tsx
 * @description Submenú «Transformar» del grupo Posición del menú contextual del objeto (mover, rotar, escalar,
 * espejar, restablecer rotación y escala) y la lista de modos de «Alinear y distribuir», que comparten el menú
 * «Acciones» y el contextual. El resto del grupo (apoyar, centrar, alinear, convertir) sale del catálogo de acciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { FlipHorizontal2, Move, RotateCw, Scale3d, Shuffle } from 'lucide-react';
import { t, type TranslationKey } from '../../../i18n';
import { userAxisLabel } from '../../../core/scene/displayAxes';
import { useKuraStore } from '../../../store/useKuraStore';
import type { AlignMode, SceneObject, TransformMode } from '../../../types/kura';
import { MenuItem, SubMenu } from './MenuKit';

/** Ejes del usuario (Z = altura) con su eje interno del motor. */
const MIRROR_AXES = [
  { internal: 'x', user: 'x' },
  { internal: 'z', user: 'y' },
  { internal: 'y', user: 'z' },
] as const;

/** Modos de alinear en el orden del inspector: X, Y (frente a fondo) y Z (altura). */
export const ALIGN_MODES = ['minX', 'centerX', 'maxX', 'maxZ', 'centerZ', 'minZ', 'minY', 'centerY', 'maxY'] as const satisfies readonly AlignMode[];

const TRANSFORM_ITEMS: ReadonlyArray<{ mode: TransformMode; key: 'move' | 'rotate' | 'scale'; shortcut: string; icon: React.ReactNode }> = [
  { mode: 'translate', key: 'move', shortcut: 'M', icon: <Move size={14} aria-hidden="true" /> },
  { mode: 'rotate', key: 'rotate', shortcut: 'R', icon: <RotateCw size={14} aria-hidden="true" /> },
  { mode: 'scale', key: 'scale', shortcut: 'S', icon: <Scale3d size={14} aria-hidden="true" /> },
];

export const TransformSubMenu: React.FC<{
  target: SceneObject;
  /** Cierra el menú y ejecuta la acción. */
  run: (fn: () => void) => () => void;
}> = ({ target, run }) => {
  const language = useKuraStore((s) => s.language);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const resetObjectsRotation = useKuraStore((s) => s.resetObjectsRotation);
  const resetObjectsScale = useKuraStore((s) => s.resetObjectsScale);
  const mirrorObject = useKuraStore((s) => s.mirrorObject);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const ids = selectedIds.includes(target.id) ? selectedIds : [target.id];

  return (
    <SubMenu icon={<Shuffle size={14} aria-hidden="true" />} label={t(language, 'menu.transform')} tip={t(language, 'menu.transform.tip')} disabled={target.locked}>
      {TRANSFORM_ITEMS.map(({ mode, key, shortcut, icon }) => (
        <MenuItem
          key={mode}
          icon={icon}
          label={t(language, `menu.transform.${key}` as TranslationKey)}
          shortcut={shortcut}
          keys={shortcut}
          onSelect={run(() => {
            setActiveTool('select');
            setTransformMode(mode);
          })}
        />
      ))}
      <SubMenu icon={<FlipHorizontal2 size={14} aria-hidden="true" />} label={t(language, 'menu.mirror')}>
        {MIRROR_AXES.map(({ internal, user }) => (
          <MenuItem key={user} label={t(language, 'menu.mirror.axis', { axis: userAxisLabel(internal) })} onSelect={run(() => mirrorObject(target.id, internal))} />
        ))}
      </SubMenu>
      <MenuItem label={t(language, 'menu.transform.resetRotation')} onSelect={run(() => resetObjectsRotation(ids))} />
      <MenuItem label={t(language, 'menu.transform.resetScale')} onSelect={run(() => resetObjectsScale(ids))} />
    </SubMenu>
  );
};

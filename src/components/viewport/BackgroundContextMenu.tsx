/**
 * @file src/components/viewport/BackgroundContextMenu.tsx
 * @description Menú contextual sobre el fondo vacío del visor: "Agregar forma" (primitivas y SVG) en un
 * hueco libre de la cama y "Repetir" la última acción. No hay portapapeles de objetos, así que no ofrece "Pegar".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { PlusCircle, Repeat2 } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { repeatLabel } from '../../store/repeatLabel';
import { type ContextMenuState } from './viewportHelpers';
import { MenuGroup, MenuItem, MenuSurface, SubMenu } from './contextMenu/MenuKit';
import { PieceShapeItems } from './contextMenu/PieceShapeItems';

const BACKGROUND_SHAPES = ['box', 'cylinder', 'sphere', 'cone', 'torus', 'prism', 'tube', 'text', 'svg'] as const;

export const BackgroundContextMenu: React.FC<{ menu: ContextMenuState; onClose: () => void }> = ({ menu, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const repeatLastAction = useKuraStore((s) => s.repeatLastAction);

  return (
    <MenuSurface x={menu.x} y={menu.y} label={t(language, 'menu.bg.label')}>
      <MenuGroup title={t(language, 'menu.group.add')}>
        <SubMenu icon={<PlusCircle size={14} aria-hidden="true" style={{ color: 'var(--accent-green)' }} />} label={t(language, 'menu.bg.add')} tip={t(language, 'menu.bg.addTip')}>
          <PieceShapeItems
            language={language}
            shapes={BACKGROUND_SHAPES}
            onPick={(shape) => {
              onClose();
              if (shape === 'svg') setActiveDialog('svg');
              else if (shape !== 'import') void createPrimitive(shape, undefined, { placement: 'free' });
            }}
          />
        </SubMenu>
        {lastRepeatable && (
          <MenuItem
            icon={<Repeat2 size={14} aria-hidden="true" />}
            label={t(language, 'repeat.label', { name: repeatLabel(language, lastRepeatable) })}
            tip={t(language, 'repeat.tip')}
            shortcut="F4"
            keys="F4"
            onSelect={() => {
              onClose();
              void repeatLastAction();
            }}
          />
        )}
      </MenuGroup>
    </MenuSurface>
  );
};

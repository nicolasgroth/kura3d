/**
 * @file src/components/viewport/BackgroundContextMenu.tsx
 * @description Menú contextual sobre el fondo vacío del visor: "Agregar forma" (primitivas y SVG) en un
 * hueco libre de la cama y "Repetir" la última acción. No hay portapapeles de objetos, así que no ofrece "Pegar".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Grid2x2X, PlusCircle, Repeat2 } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { repeatLabel } from '../../store/repeatLabel';
import { discParams } from '../../core/scene/pieceSizing';
import { type ContextMenuState } from './viewportHelpers';
import { MenuGroup, MenuItem, MenuSurface, SubMenu } from './contextMenu/MenuKit';
import { PieceShapeItems } from './contextMenu/PieceShapeItems';

/** Radio inicial del disco: diámetro 32 mm, alto 3,2 mm (10 %). */
const DEFAULT_DISC_RADIUS_MM = 16;

const BACKGROUND_SHAPES = ['box', 'cylinder', 'disc', 'sphere', 'cone', 'torus', 'prism', 'tube', 'text', 'svg'] as const;

export const BackgroundContextMenu: React.FC<{ menu: ContextMenuState; onClose: () => void }> = ({ menu, onClose }) => {
  const language = useKuraStore((s) => s.language);
  const createPrimitive = useKuraStore((s) => s.createPrimitive);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const lastRepeatable = useKuraStore((s) => s.lastRepeatable);
  const repeatLastAction = useKuraStore((s) => s.repeatLastAction);
  const showBed = useKuraStore((s) => s.showBed);
  const toggleShowBed = useKuraStore((s) => s.toggleShowBed);

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
              else if (shape === 'disc') void createPrimitive('cylinder', discParams(DEFAULT_DISC_RADIUS_MM), { placement: 'free', label: t(language, 'menu.shape.disc') });
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
      <MenuGroup title={t(language, 'ux6.menu.view')}>
        <MenuItem
          icon={<Grid2x2X size={14} aria-hidden="true" />}
          label={t(language, showBed ? 'ux6.bed.cmdHide' : 'ux6.bed.cmdShow')}
          tip={t(language, 'ux6.bed.toggleTip')}
          shortcut="B"
          keys="B"
          onSelect={() => {
            onClose();
            toggleShowBed();
          }}
        />
      </MenuGroup>
    </MenuSurface>
  );
};

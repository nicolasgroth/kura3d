/**
 * @file src/store/repeatLabel.ts
 * @description Nombre legible de la acción repetible (F4) para el menú, la paleta y los avisos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { userAxisLabel } from '../core/scene/displayAxes';
import { t, type TranslationKey } from '../i18n';
import type { LanguageCode } from '../types/kura';
import { ROLE_LABEL_KEY } from './roleLabels';
import type { RepeatRecord } from './quickActionsTypes';

export function repeatLabel(language: LanguageCode, rec: RepeatRecord): string {
  switch (rec.kind) {
    case 'duplicate': return t(language, 'repeat.name.duplicate');
    case 'nudge': return t(language, 'repeat.name.move');
    case 'transform':
      return t(language, rec.part === 'position' ? 'repeat.name.move' : rec.part === 'rotation' ? 'repeat.name.rotate' : 'repeat.name.scale');
    case 'hollow': return t(language, 'repeat.name.hollow', { mm: rec.wallThickness });
    case 'mirror': return t(language, 'repeat.name.mirror', { axis: userAxisLabel(rec.axis) });
    case 'planeCut': return t(language, 'dialog.cut.title');
    case 'applyHoles': return t(language, 'repeat.name.applyHoles');
    case 'addPiece':
      return t(language, rec.mode === 'negative' ? 'repeat.name.addNegative' : 'repeat.name.addPart', {
        shape: t(language, `menu.shape.${rec.shape}` as TranslationKey),
      });
    case 'centerOnBed':
    case 'centerObjectOnBed': return t(language, 'repeat.name.centerOnBed');
    case 'dropToBed': return t(language, 'ux3.repeat.dropToBed');
    case 'resetOrientation': return t(language, 'ux3.repeat.resetOrientation');
    case 'resetRotation': return t(language, 'ux3.repeat.resetRotation');
    case 'resetScale': return t(language, 'ux3.repeat.resetScale');
    case 'align': return t(language, rec.mode === 'arrange_grid' ? 'ux3.repeat.arrange' : 'ux3.repeat.align');
    case 'material': return t(language, 'ux3.repeat.material');
    case 'group': return t(language, 'groups.action.group');
    case 'combine': return t(language, 'groups.action.combine');
    case 'arrangePlates': return t(language, 'plates.action.arrange');
    case 'convertGroupsToPlates': return t(language, 'plates.history.convert', { count: rec.count });
    case 'simplify': return t(language, 'repeat.name.simplify');
    case 'color': return t(language, 'repeat.name.color');
    case 'setType':
      return t(language, 'repeat.name.setType', { type: t(language, ROLE_LABEL_KEY[rec.role]) });
  }
}

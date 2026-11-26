/**
 * @file src/components/magnet/magnetPaletteItems.tsx
 * @description Entrada «Alojamiento de imán» de la paleta de comandos: abre el panel (si no hay pieza sólida, avisa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { Magnet } from 'lucide-react';
import { t } from '../../i18n';
import { openMagnetPanel } from '../../store/magnetPanel';
import type { LanguageCode } from '../../types/kura';
import type { AssistantPaletteItem } from '../assistants/assistantPaletteItems';

export function magnetPaletteItems(language: LanguageCode, category: string): AssistantPaletteItem[] {
  return [{
    id: 'gen-magnet-pocket',
    label: t(language, 'magnet.title'),
    category,
    keywords: t(language, 'magnet.cmd.keywords'),
    kind: 'local',
    icon: <Magnet size={15} />,
    run: () => void openMagnetPanel(),
  }];
}

/**
 * @file src/components/cablePass/cablePassPaletteItems.tsx
 * @description Entrada «Paso de cable» de la paleta de comandos: abre el panel (si no hay pieza sólida, avisa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Cable } from 'lucide-react';
import { t } from '../../i18n';
import { openCablePassPanel } from '../../store/cablePassPanel';
import type { LanguageCode } from '../../types/kura';
import type { AssistantPaletteItem } from '../assistants/assistantPaletteItems';

export function cablePassPaletteItems(language: LanguageCode, category: string): AssistantPaletteItem[] {
  return [{
    id: 'gen-cable-pass',
    label: t(language, 'cable.title'),
    category,
    keywords: t(language, 'cable.cmd.keywords'),
    kind: 'local',
    icon: <Cable size={15} />,
    run: () => void openCablePassPanel(),
  }];
}

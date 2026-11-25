/**
 * @file src/components/keyhole/keyholePaletteItems.tsx
 * @description Entrada «Colgar en el muro» de la paleta de comandos: abre el panel (si no hay pieza sólida, avisa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { KeyRound } from 'lucide-react';
import { t } from '../../i18n';
import { openKeyholePanel } from '../../store/keyholePanel';
import type { LanguageCode } from '../../types/kura';
import type { AssistantPaletteItem } from '../assistants/assistantPaletteItems';

export function keyholePaletteItems(language: LanguageCode, category: string): AssistantPaletteItem[] {
  return [{
    id: 'gen-keyhole',
    label: t(language, 'keyhole.title'),
    category,
    keywords: t(language, 'keyhole.cmd.keywords'),
    kind: 'local',
    icon: <KeyRound size={15} />,
    run: () => void openKeyholePanel(),
  }];
}

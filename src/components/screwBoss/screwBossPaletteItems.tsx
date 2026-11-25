/**
 * @file src/components/screwBoss/screwBossPaletteItems.tsx
 * @description Entrada «Torreta para tornillo» de la paleta de comandos: abre el panel (si no hay pieza sólida, avisa).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { CircleDot } from 'lucide-react';
import { t } from '../../i18n';
import { openScrewBossPanel } from '../../store/screwBossPanel';
import type { LanguageCode } from '../../types/kura';
import type { AssistantPaletteItem } from '../assistants/assistantPaletteItems';

export function screwBossPaletteItems(language: LanguageCode, category: string): AssistantPaletteItem[] {
  return [{
    id: 'gen-screw-boss',
    label: t(language, 'turret.title'),
    category,
    keywords: t(language, 'turret.cmd.keywords'),
    kind: 'local',
    icon: <CircleDot size={15} />,
    run: () => void openScrewBossPanel(),
  }];
}

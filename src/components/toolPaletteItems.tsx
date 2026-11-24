/**
 * @file src/components/toolPaletteItems.tsx
 * @description Entradas de la paleta de comandos para las herramientas de la barra vertical (Mover, Rotar, Escalar,
 * Pintar, Medir). Se activan con la misma regla que la barra y los atajos (`toolActivation`); una herramienta
 * apagada lleva su motivo (`unavailable`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Move, Paintbrush, RotateCw, Ruler, Scale3d } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { activateRailTool, toolDisabledText } from '../store/toolActivation';
import { toolAvailability, type RailToolId } from '../store/toolAvailability';
import type { LanguageCode, SceneObject } from '../types/kura';

export interface ToolPaletteItem {
  id: string;
  label: string;
  category: string;
  keywords: string;
  shortcut?: string;
  kind: 'local';
  icon: React.ReactNode;
  run: () => void;
  /** Motivo si la herramienta está apagada ahora. */
  unavailable?: string;
}

const TOOLS: ReadonlyArray<{ tool: RailToolId; id: string; label: TranslationKey; shortcut: string; keywords: string; icon: React.ReactNode }> = [
  { tool: 'move', id: 'tool-move', label: 'rediseno.tool.move', shortcut: 'M', keywords: 'mover trasladar posicion move translate position', icon: <Move size={15} /> },
  { tool: 'rotate', id: 'tool-rotate', label: 'rediseno.tool.rotate', shortcut: 'R', keywords: 'rotar girar rotacion rotate turn', icon: <RotateCw size={15} /> },
  { tool: 'scale', id: 'tool-scale', label: 'rediseno.tool.scale', shortcut: 'S', keywords: 'escalar tamaño medidas scale size resize', icon: <Scale3d size={15} /> },
  { tool: 'paint', id: 'tool-paint', label: 'topbar.tool.paint', shortcut: 'P', keywords: 'pintar color pincel filamento paint brush color', icon: <Paintbrush size={15} /> },
  {
    tool: 'measure',
    id: 'tool-measure',
    label: 'cmd.tool.measure',
    shortcut: 'D',
    keywords: 'medir regla distancia area angulo capacidad volumen litros recipiente measure ruler distance angle capacity volume',
    icon: <Ruler size={15} />,
  },
];

export function toolPaletteItems(language: LanguageCode, category: string, objects: SceneObject[], selectedIds: string[]): ToolPaletteItem[] {
  return TOOLS.map(({ tool, id, label, shortcut, keywords, icon }) => {
    const availability = toolAvailability({ objects, selectedIds }, tool);
    return {
      id,
      label: t(language, label),
      category,
      keywords,
      shortcut,
      kind: 'local',
      icon,
      run: () => void activateRailTool(tool),
      ...(availability.reason ? { unavailable: toolDisabledText(tool, availability.reason) } : {}),
    };
  });
}

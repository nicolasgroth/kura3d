/**
 * @file src/components/shell/ToolRail.tsx
 * @description Barra vertical de herramientas pegada al borde izquierdo del visor (patrón «toolbar» de WAI-ARIA:
 * una sola parada de tabulación, foco itinerante con flechas, Inicio y Fin). Seleccionar y los modos del
 * manipulador (Mover, Rotar, Escalar), y las herramientas de puntero (Pintar, Cortar, Esculpir / Borrar, Medir).
 * El botón activo lleva `aria-pressed` y una marca lateral además del color. Cada herramienta se enciende o apaga
 * según `toolAvailability` (apagada: `aria-disabled`, conserva foco y tooltip, y el motivo va en `data-help-reason`). Los atajos de teclado globales
 * (V, M/G/W, R, S, P, C, D) siguen en `App`. En pantallas estrechas se oculta: las herramientas siguen en el
 * menú «Más» de la barra superior y en la barra de transformación inferior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef, useState } from 'react';
import { Eraser, MousePointer, Move, Paintbrush, RotateCw, Ruler, Scale3d, Scissors } from 'lucide-react';
import { t } from '../../i18n';
import { activateRailTool, toolDisabledText } from '../../store/toolActivation';
import { allToolAvailability, type RailToolId } from '../../store/toolAvailability';
import { useKuraStore } from '../../store/useKuraStore';
import type { ActiveTool, TransformMode } from '../../types/kura';
import { CONTROL_HELP, helpAttrs, helpLabel, type HelpId } from './controlHelp';
import '../../styles/shellRail.css';
import '../../styles/toolAvailability.css';

interface RailItem {
  help: HelpId;
  icon: React.ReactNode;
  /** Herramienta que activa. */
  tool: ActiveTool;
  /** Modo del manipulador (solo Mover, Rotar y Escalar). */
  mode?: TransformMode;
}

const ICON = 20;

export const RAIL_GROUPS: ReadonlyArray<ReadonlyArray<RailItem>> = [
  [
    { help: 'tool.select', icon: <MousePointer size={ICON} aria-hidden="true" />, tool: 'select' },
    { help: 'tool.move', icon: <Move size={ICON} aria-hidden="true" />, tool: 'select', mode: 'translate' },
    { help: 'tool.rotate', icon: <RotateCw size={ICON} aria-hidden="true" />, tool: 'select', mode: 'rotate' },
    { help: 'tool.scale', icon: <Scale3d size={ICON} aria-hidden="true" />, tool: 'select', mode: 'scale' },
  ],
  [
    { help: 'tool.paint', icon: <Paintbrush size={ICON} aria-hidden="true" />, tool: 'paint' },
    { help: 'tool.cut', icon: <Scissors size={ICON} aria-hidden="true" />, tool: 'cut' },
    { help: 'tool.erase', icon: <Eraser size={ICON} aria-hidden="true" />, tool: 'erase' },
    { help: 'tool.measure', icon: <Ruler size={ICON} aria-hidden="true" />, tool: 'measure' },
  ],
];

const FLAT = RAIL_GROUPS.flat();

export const ToolRail: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  // Disponibilidad según la escena y la selección (`toolAvailability`): apagada = `aria-disabled` con motivo.
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const availability = allToolAvailability({ objects, selectedIds });
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const isPressed = (item: RailItem) =>
    item.mode ? activeTool === 'select' && transformMode === item.mode : activeTool === item.tool;

  const railId = (item: RailItem) => item.help.slice('tool.'.length) as RailToolId;
  const choose = (item: RailItem) => {
    activateRailTool(railId(item));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number | undefined> = {
      ArrowDown: (focusIndex + 1) % FLAT.length,
      ArrowRight: (focusIndex + 1) % FLAT.length,
      ArrowUp: (focusIndex - 1 + FLAT.length) % FLAT.length,
      ArrowLeft: (focusIndex - 1 + FLAT.length) % FLAT.length,
      Home: 0,
      End: FLAT.length - 1,
    };
    const next = keys[e.key];
    if (next === undefined) return;
    // La barra consume sus flechas: no deben empujar el objeto seleccionado.
    e.preventDefault();
    e.stopPropagation();
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  let index = -1;
  return (
    <div
      className="kura-tool-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t(language, 'topbar.toolsGroup')}
      id="kura-tool-rail"
      onKeyDown={onKeyDown}
    >
      {RAIL_GROUPS.map((group, g) => (
        <React.Fragment key={g}>
          {g > 0 && <div className="kura-tool-rail-sep" role="separator" aria-orientation="horizontal" />}
          {group.map((item) => {
            index += 1;
            const i = index;
            const pressed = isPressed(item);
            const name = t(language, CONTROL_HELP[item.help].name);
            const state = availability[railId(item)];
            const reason = state.reason ? toolDisabledText(railId(item), state.reason) : undefined;
            return (
              <button
                key={item.help}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                className={`kura-tool-rail-btn${pressed ? ' is-active' : ''}${item.mode ? ' is-mode' : ''}${reason ? ' is-unavailable' : ''}`}
                aria-pressed={pressed}
                aria-label={name}
                aria-disabled={reason ? true : undefined}
                data-help-reason={reason}
                tabIndex={i === focusIndex ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onClick={() => choose(item)}
                {...helpAttrs(item.help, language)}
              >
                {item.icon}
                <span className="kura-tool-rail-label" aria-hidden="true">{helpLabel(language, item.help)}</span>
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

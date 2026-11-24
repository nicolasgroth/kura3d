/**
 * @file src/components/shell/ToolRail.tsx
 * @description Barra vertical de herramientas pegada al borde izquierdo del visor (patrón «toolbar» de WAI-ARIA:
 * una sola parada de tabulación, foco itinerante con flechas, Inicio y Fin). Seleccionar y los modos del
 * manipulador (Mover, Rotar, Escalar), y las herramientas de puntero (Pintar, Cortar, Esculpir / Borrar, Medir).
 * El botón activo lleva `aria-pressed` y una marca lateral además del color. Los atajos de teclado globales
 * (V, M/G/W, R, S, P, C, D) siguen en `App`. Arriba, el botón «Agregar» (`AddRailButton`) abre a su derecha el
 * menú de primitivas; es la primera parada del recorrido con flechas. En pantallas estrechas se oculta: las herramientas siguen en el
 * menú «Más» de la barra superior y en la barra de transformación inferior.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useRef, useState } from 'react';
import { Eraser, MousePointer, Move, Paintbrush, RotateCw, Ruler, Scale3d, Scissors } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { ActiveTool, TransformMode } from '../../types/kura';
import { CONTROL_HELP, helpAttrs, helpLabel, type HelpId } from './controlHelp';
import { AddRailButton } from './InsertMenus';
import '../../styles/shellRail.css';

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
/** Paradas del recorrido con flechas: «Agregar» (índice 0) y luego cada herramienta. */
const STOPS = FLAT.length + 1;

export const ToolRail: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const activeTool = useKuraStore((s) => s.activeTool);
  const transformMode = useKuraStore((s) => s.transformMode);
  const setActiveTool = useKuraStore((s) => s.setActiveTool);
  const setTransformMode = useKuraStore((s) => s.setTransformMode);
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const isPressed = (item: RailItem) =>
    item.mode ? activeTool === 'select' && transformMode === item.mode : activeTool === item.tool;

  const choose = (item: RailItem) => {
    setActiveTool(item.tool);
    if (item.mode) setTransformMode(item.mode);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number | undefined> = {
      ArrowDown: (focusIndex + 1) % STOPS,
      ArrowRight: (focusIndex + 1) % STOPS,
      ArrowUp: (focusIndex - 1 + STOPS) % STOPS,
      ArrowLeft: (focusIndex - 1 + STOPS) % STOPS,
      Home: 0,
      End: STOPS - 1,
    };
    const next = keys[e.key];
    if (next === undefined) return;
    // La barra consume sus flechas: no deben empujar el objeto seleccionado.
    e.preventDefault();
    e.stopPropagation();
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  let index = 0;
  return (
    <div
      className="kura-tool-rail"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t(language, 'topbar.toolsGroup')}
      id="kura-tool-rail"
      onKeyDown={onKeyDown}
    >
      <AddRailButton
        tabIndex={focusIndex === 0 ? 0 : -1}
        buttonRef={(el) => {
          refs.current[0] = el;
        }}
        onFocus={() => setFocusIndex(0)}
      />
      {RAIL_GROUPS.map((group, g) => (
        <React.Fragment key={g}>
          <div className="kura-tool-rail-sep" role="separator" aria-orientation="horizontal" />
          {group.map((item) => {
            index += 1;
            const i = index;
            const pressed = isPressed(item);
            const name = t(language, CONTROL_HELP[item.help].name);
            return (
              <button
                key={item.help}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                className={`kura-tool-rail-btn${pressed ? ' is-active' : ''}${item.mode ? ' is-mode' : ''}`}
                aria-pressed={pressed}
                aria-label={name}
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

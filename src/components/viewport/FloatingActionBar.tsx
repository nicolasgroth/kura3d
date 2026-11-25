/**
 * @file src/components/viewport/FloatingActionBar.tsx
 * @description Barra flotante de acciones rápidas junto al objeto seleccionado: Color, Duplicar, Ocultar, Bloquear,
 * Eliminar y «Más» (abre el menú contextual del objeto). `role="toolbar"` con una sola parada de tabulación y flechas
 * entre botones (patrón de `ToolRail`); Alt+. pasa el foco a la barra sin robarlo al seleccionar. La posición la escribe
 * `FloatingBarTracker` en `style.transform` desde el bucle del visor; aquí solo se decide si se muestra y qué lleva.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Eye, EyeOff, Lock, MoreHorizontal, Palette, Trash2, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { floatingBarVisible, useFloatingBarPrefs } from '../../store/floatingBarState';
import { useMagnetPanel } from '../../store/magnetPanel';
import { useScrewBossPanel } from '../../store/screwBossPanel';
import { useKuraStore } from '../../store/useKuraStore';
import { applyFloatingBarColor, floatingBarItems, runFloatingBarAction, type FloatingBarActionId } from './floatingBarActions';
import { measureFloatingBar, registerFloatingBar } from './floatingBarBridge';
import '../../styles/floatingBar.css';

const ICON = 16;

interface Props {
  /** Hay un menú contextual abierto en el visor: la barra se oculta. */
  contextMenuOpen: boolean;
  /** «Más»: abre el menú contextual del objeto en esas coordenadas de pantalla. */
  onMore: (objectId: string, clientX: number, clientY: number) => void;
}

export const FloatingActionBar: React.FC<Props> = ({ contextMenuOpen, onMore }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const activeTool = useKuraStore((s) => s.activeTool);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const pickingSurface = useKuraStore((s) => s.surfacePick !== null);
  const operationOpen = useKuraStore((s) => s.activeDialog !== null);
  const magnetOpen = useMagnetPanel((s) => s.open);
  const screwBossOpen = useScrewBossPanel((s) => s.open);
  const enabled = useFloatingBarPrefs((s) => s.enabled);
  const visible = floatingBarVisible({
    enabled,
    selectedCount: selectedIds.length,
    activeTool,
    uiDensity,
    pickingSurface,
    operationOpen,
    magnetOpen,
    screwBossOpen,
    contextMenuOpen,
  });

  const barRef = useRef<HTMLDivElement | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const colorInput = useRef<HTMLInputElement | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const setBar = useCallback((el: HTMLDivElement | null) => {
    barRef.current = el;
    registerFloatingBar(el);
  }, []);

  // Tamaño real de la barra para colocarla (cambia con el idioma o con la selección).
  useEffect(() => {
    const el = barRef.current;
    if (!visible || !el) return;
    const measure = () => measureFloatingBar(el.offsetWidth, el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);

  // Alt+. lleva el foco a la barra (sin robarlo al seleccionar).
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'Period') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      buttons.current[focusIndex]?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, focusIndex]);

  if (!visible) return null;

  const items = floatingBarItems(objects, selectedIds);
  const primary = objects.find((o) => o.id === selectedIds[0]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Devuelve el foco al lienzo del visor (sin deseleccionar).
      e.preventDefault();
      barRef.current?.parentElement?.querySelector<HTMLElement>('canvas')?.focus({ preventScroll: true });
      return;
    }
    const n = items.length;
    const keys: Record<string, number | undefined> = {
      ArrowRight: (focusIndex + 1) % n,
      ArrowDown: (focusIndex + 1) % n,
      ArrowLeft: (focusIndex - 1 + n) % n,
      ArrowUp: (focusIndex - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const next = keys[e.key];
    if (next === undefined) return;
    // La barra consume sus flechas: no deben empujar el objeto seleccionado.
    e.preventDefault();
    e.stopPropagation();
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  const run = (id: FloatingBarActionId, disabled: boolean | undefined, button: HTMLButtonElement) => {
    if (id === 'color') {
      const input = colorInput.current;
      if (!input) return;
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
          return;
        } catch {
          /* sin selector nativo: se cae al clic */
        }
      }
      input.click();
      return;
    }
    if (id === 'more') {
      const r = button.getBoundingClientRect();
      if (primary) onMore(primary.id, r.left, r.bottom + 4);
      return;
    }
    if (disabled) return;
    runFloatingBarAction(id);
  };

  const iconOf = (id: FloatingBarActionId, pressed: boolean | undefined, labelKey: string) => {
    switch (id) {
      case 'color':
        return <Palette size={ICON} aria-hidden="true" />;
      case 'duplicate':
        return <Copy size={ICON} aria-hidden="true" />;
      case 'hide':
        return labelKey === 'ux8.menu.show' ? <Eye size={ICON} aria-hidden="true" /> : <EyeOff size={ICON} aria-hidden="true" />;
      case 'lock':
        return pressed ? <Lock size={ICON} aria-hidden="true" /> : <Unlock size={ICON} aria-hidden="true" />;
      case 'delete':
        return <Trash2 size={ICON} aria-hidden="true" />;
      default:
        return <MoreHorizontal size={ICON} aria-hidden="true" />;
    }
  };

  return (
    <div
      ref={setBar}
      className="kura-floating-bar"
      role="toolbar"
      aria-orientation="horizontal"
      aria-label={t(language, 'floatingBar.label')}
      data-testid="floating-action-bar"
      data-busy="true"
      onKeyDown={onKeyDown}
      // La barra no debe quitar la selección ni mover la cámara al pulsarla.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        const name = t(language, item.labelKey);
        const tip = item.tipKey ? t(language, item.tipKey) : name;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            className={`kura-floating-bar-btn${item.id === 'delete' ? ' is-danger' : ''}${item.pressed ? ' is-pressed' : ''}`}
            aria-label={name}
            title={tip}
            data-action={item.id}
            aria-pressed={item.id === 'lock' ? Boolean(item.pressed) : undefined}
            aria-haspopup={item.id === 'more' ? 'menu' : undefined}
            aria-disabled={item.disabled ? true : undefined}
            tabIndex={i === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(i)}
            onClick={(e) => run(item.id, item.disabled, e.currentTarget)}
          >
            {iconOf(item.id, item.pressed, item.labelKey)}
            {item.id === 'color' && primary && <span className="kura-floating-bar-dot" style={{ background: primary.color }} aria-hidden="true" />}
          </button>
        );
      })}
      {/* Selector de color base del navegador (el mismo campo del inspector); lo abre el botón Color. */}
      <input
        ref={colorInput}
        type="color"
        className="kura-floating-bar-color"
        tabIndex={-1}
        aria-hidden="true"
        value={primary?.color ?? '#808080'}
        onChange={(e) => applyFloatingBarColor(e.target.value)}
      />
    </div>
  );
};

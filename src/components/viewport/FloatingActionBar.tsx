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
import { useShallow } from 'zustand/react/shallow';
import { Copy, Eye, EyeOff, Lock, MoreHorizontal, Palette, Trash2, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { floatingBarVisible, useFloatingBarPrefs } from '../../store/floatingBarState';
import { useCablePassPanel } from '../../store/cablePassPanel';
import { useKeyholePanel } from '../../store/keyholePanel';
import { useMagnetPanel } from '../../store/magnetPanel';
import { useScrewBossPanel } from '../../store/screwBossPanel';
import { panelContextOf } from '../../store/panelContext';
import { useKuraStore } from '../../store/useKuraStore';
import { applyFloatingBarColor, floatingBarItemsFor, floatingBarSelection, runFloatingBarAction, type FloatingBarActionId, type FloatingBarItem } from './floatingBarActions';
import { measureFloatingBar, registerFloatingBar } from './floatingBarBridge';
import { FloatingBarColorPalette } from './FloatingBarColorPalette';
import { focusWhenShown } from './floatingBarFocus';
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
  // Selector estrecho: la barra se vuelve a pintar solo si cambia lo que muestra, no con cada edición de la escena.
  const selection = useKuraStore(useShallow((s) => floatingBarSelection(s.objects, s.selectedIds)));
  const selectedCount = useKuraStore((s) => s.selectedIds.length);
  const activeTool = useKuraStore((s) => s.activeTool);
  const uiDensity = useKuraStore((s) => s.uiDensity);
  const pickingSurface = useKuraStore((s) => s.surfacePick !== null);
  const operationOpen = useKuraStore((s) => s.activeDialog !== null);
  // Regla única: ningún panel de operación (`activeDialog`) ni de colocación (imán, tornillo, colgar en el muro, paso de cable).
  const magnetOpen = useMagnetPanel((s) => s.open);
  const screwBossOpen = useScrewBossPanel((s) => s.open);
  const keyholeOpen = useKeyholePanel((s) => s.open);
  const cablePassOpen = useCablePassPanel((s) => s.open);
  const placementPanelOpen = magnetOpen || screwBossOpen || keyholeOpen || cablePassOpen;
  // Panel contextual de una acción del inspector (Suavizar, Orientar, Simplificar…): misma regla que un diálogo.
  const actionPanelOpen = useKuraStore((s) => panelContextOf(s).kind === 'action');
  const enabled = useFloatingBarPrefs((s) => s.enabled);
  const visible = floatingBarVisible({
    enabled,
    selectedCount,
    activeTool,
    uiDensity,
    pickingSurface,
    operationOpen,
    placementPanelOpen,
    actionPanelOpen,
    contextMenuOpen,
  });

  const barRef = useRef<HTMLDivElement | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const colorInput = useRef<HTMLInputElement | null>(null);
  const colorGesture = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // «Más» abre un menú que oculta la barra: al cerrarlo con Escape el foco vuelve al botón «Más».
  const openedFromMore = useRef(false);
  const escapedMenu = useRef(false);
  // El evento nativo `change` (soltar el selector) cierra el gesto: el siguiente cambio vuelve a guardar un paso.
  useEffect(() => {
    const input = colorInput.current;
    if (!input) return;
    const end = () => {
      colorGesture.current = false;
    };
    input.addEventListener('change', end);
    input.addEventListener('blur', end);
    return () => {
      input.removeEventListener('change', end);
      input.removeEventListener('blur', end);
    };
  }, [visible]);
  useEffect(() => {
    if (!contextMenuOpen) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openedFromMore.current) escapedMenu.current = true;
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [contextMenuOpen]);
  useEffect(() => {
    if (contextMenuOpen || !visible) return;
    const restore = escapedMenu.current;
    openedFromMore.current = false;
    escapedMenu.current = false;
    if (!restore) return;
    // La barra reaparece sin colocar: el foco espera a que el visor la muestre.
    return focusWhenShown(() => barRef.current, () => buttons.current[buttons.current.length - 1]);
  }, [contextMenuOpen, visible]);
  // La paleta se cierra al ocultarse la barra o al pulsar fuera de ella.
  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setPaletteOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [paletteOpen]);
  useEffect(() => {
    if (!visible) setPaletteOpen(false);
  }, [visible]);

  const items = floatingBarItemsFor(selection);
  const [rawFocusIndex, setFocusIndex] = useState(0);
  // Si cambia la cantidad de botones, la parada de tabulación nunca queda fuera de la barra.
  const focusIndex = Math.min(rawFocusIndex, items.length - 1);

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


  const closePalette = (focusColor: boolean) => {
    setPaletteOpen(false);
    if (focusColor) buttons.current[items.findIndex((it) => it.id === 'color')]?.focus();
  };
  const openNativePicker = () => {
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
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Dentro de la paleta de color solo Escape lo gestiona la barra (cierra y devuelve el foco al botón Color).
    if ((e.target as HTMLElement).closest?.('.kura-floating-bar-palette')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closePalette(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (paletteOpen) {
        e.preventDefault();
        closePalette(true);
        return;
      }
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
      if (disabled) return;
      setPaletteOpen((open) => !open);
      return;
    }
    if (id === 'more') {
      setPaletteOpen(false);
      openedFromMore.current = true;
      const r = button.getBoundingClientRect();
      if (selection.primaryId) onMore(selection.primaryId, r.left, r.bottom + 4);
      return;
    }
    if (disabled) return;
    setPaletteOpen(false);
    runFloatingBarAction(id);
  };

  const iconOf = (icon: FloatingBarItem['icon']) => {
    switch (icon) {
      case 'palette':
        return <Palette size={ICON} aria-hidden="true" />;
      case 'copy':
        return <Copy size={ICON} aria-hidden="true" />;
      case 'eye':
        return <Eye size={ICON} aria-hidden="true" />;
      case 'eye-off':
        return <EyeOff size={ICON} aria-hidden="true" />;
      case 'lock':
        return <Lock size={ICON} aria-hidden="true" />;
      case 'unlock':
        return <Unlock size={ICON} aria-hidden="true" />;
      case 'trash':
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
      aria-keyshortcuts="Alt+Period"
      title={`${t(language, 'floatingBar.label')} (Alt+.)`}
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
            aria-haspopup={item.id === 'more' ? 'menu' : item.id === 'color' ? 'true' : undefined}
            aria-expanded={item.id === 'color' ? paletteOpen : undefined}
            aria-disabled={item.disabled ? true : undefined}
            tabIndex={i === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(i)}
            onClick={(e) => run(item.id, item.disabled, e.currentTarget)}
          >
            {iconOf(item.icon)}
            {item.id === 'color' && selection.primaryColor && <span className="kura-floating-bar-dot" style={{ background: selection.primaryColor }} aria-hidden="true" />}
          </button>
        );
      })}
      {paletteOpen && (
        <FloatingBarColorPalette
          current={selection.primaryColor}
          onPick={(hex) => {
            // Una muestra = un paso de deshacer.
            applyFloatingBarColor(hex, true);
            closePalette(true);
          }}
          onCustom={() => {
            closePalette(false);
            openNativePicker();
          }}
        />
      )}
      {/* Selector libre del navegador: la última opción de la paleta lo abre (queda oculto junto a la barra). */}
      <input
        ref={colorInput}
        type="color"
        className="kura-floating-bar-color"
        tabIndex={-1}
        aria-hidden="true"
        value={selection.primaryColor ?? '#808080'}
        onChange={(e) => {
          // Un gesto de arrastre = un paso de deshacer: el primer cambio lo guarda, el resto es vista en vivo.
          applyFloatingBarColor(e.target.value, !colorGesture.current);
          colorGesture.current = true;
        }}
      />
    </div>
  );
};

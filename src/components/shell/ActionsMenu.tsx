/**
 * @file src/components/shell/ActionsMenu.tsx
 * @description Menú «Acciones» de la barra superior: botón con `aria-haspopup="menu"` que abre un menú
 * accesible (`role="menu"`, flechas, Inicio/Fin, → y ← para submenús, Esc cierra y devuelve el foco) con las
 * operaciones agrupadas del catálogo (`store/actionsCatalog.ts`) y sus atajos a la derecha. Un ítem
 * deshabilitado muestra debajo por qué (sin selección, bloqueado, tipo no válido…). Reutiliza las piezas del
 * menú contextual (`MenuKit`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  ArrowDownToLine,
  Box,
  Boxes,
  ChevronDown,
  Combine,
  Crosshair,
  Grid3x3,
  Group,
  Merge,
  Minimize2,
  PaintBucket,
  Puzzle,
  Ruler,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Split,
  ToggleLeft,
  Type,
  Ungroup,
  Wand2,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { OBJECT_ROLES } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import { ACTION_GROUPS, ACTION_SHORTCUTS, actionAvailability, type ActionId } from '../../store/actionsCatalog';
import { ROLE_LABEL_KEY } from '../../store/roleLabels';
import { useKuraStore } from '../../store/useKuraStore';
import { MenuGroup, MenuItem, MenuSurface, SubMenu } from '../viewport/contextMenu/MenuKit';
import { ALIGN_MODES } from '../viewport/contextMenu/ObjectMenuPosition';
import { helpAttrs, MOD_LABEL } from './controlHelp';
import { runAction, runAlign, runConvert } from './actionRunners';
import '../../styles/rowContextMenu.css';

const ICONS: Record<ActionId, React.ReactNode> = {
  hollow: <Box size={14} aria-hidden="true" />,
  splitForBed: <Grid3x3 size={14} aria-hidden="true" />,
  fitToBed: <Minimize2 size={14} aria-hidden="true" />,
  mold: <PaintBucket size={14} aria-hidden="true" />,
  project: <Type size={14} aria-hidden="true" />,
  modules: <Puzzle size={14} aria-hidden="true" />,
  texture: <Waves size={14} aria-hidden="true" />,
  repair: <Wrench size={14} aria-hidden="true" />,
  simplify: <Sparkles size={14} aria-hidden="true" />,
  refine: <Wand2 size={14} aria-hidden="true" />,
  hull: <Box size={14} aria-hidden="true" />,
  splitColors: <Sparkles size={14} aria-hidden="true" />,
  splitParts: <Split size={14} aria-hidden="true" />,
  group: <Group size={14} aria-hidden="true" />,
  ungroup: <Ungroup size={14} aria-hidden="true" />,
  combine: <Boxes size={14} aria-hidden="true" />,
  union: <Merge size={14} aria-hidden="true" />,
  applyHoles: <Combine size={14} aria-hidden="true" />,
  convert: <ToggleLeft size={14} aria-hidden="true" />,
  dropToBed: <ArrowDownToLine size={14} aria-hidden="true" />,
  centerOnBed: <Crosshair size={14} aria-hidden="true" />,
  align: <AlignCenter size={14} aria-hidden="true" />,
  validate: <ShieldCheck size={14} aria-hidden="true" />,
  detect: <ScanSearch size={14} aria-hidden="true" />,
  fitCheck: <Ruler size={14} aria-hidden="true" />,
};

/** Ancho del menú para acotarlo a la ventana (coincide con `contextMenuFit.css`). */
const MENU_WIDTH = 300;

export const ActionsMenu: React.FC<{ showLabel: boolean }> = ({ showLabel }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const open = anchor !== null;

  const close = (returnFocus = true) => {
    setAnchor(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // En captura: Esc cierra el menú antes de que los atajos globales lo usen (salir de un grupo…).
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.kura-actions-layer') && !triggerRef.current?.contains(target)) close(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchor({ x: Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8)), y: r.bottom + 4 });
  };

  const state = { objects, selectedIds, groups, busyOperation };
  const pick = (fn: () => void) => () => {
    close();
    fn();
  };
  const label = t(language, 'rediseno.actions.menu');

  const item = (id: ActionId) => {
    const availability = actionAvailability(state, id);
    const shortcut = ACTION_SHORTCUTS[id];
    const name = t(language, `rediseno.action.${id}` as TranslationKey);
    const reason = availability.reason ? t(language, availability.reason) : undefined;
    if (id === 'convert') {
      return (
        <SubMenu key={id} icon={ICONS[id]} label={name} tip={reason} disabled={!availability.enabled}>
          {OBJECT_ROLES.map((role) => (
            <MenuItem key={role} label={t(language, ROLE_LABEL_KEY[role])} onSelect={pick(() => runConvert(role))} />
          ))}
        </SubMenu>
      );
    }
    if (id === 'align') {
      return (
        <SubMenu key={id} icon={ICONS[id]} label={name} tip={reason} disabled={!availability.enabled}>
          {ALIGN_MODES.map((mode) => (
            <MenuItem key={mode} label={t(language, `align.label.${mode}`)} tip={t(language, `align.tip.${mode}`)} onSelect={pick(() => runAlign(mode))} />
          ))}
          <MenuItem label={t(language, 'inspector.pro.arrangeGrid')} onSelect={pick(() => runAlign('arrange_grid'))} />
        </SubMenu>
      );
    }
    return (
      <MenuItem
        key={id}
        icon={ICONS[id]}
        label={name}
        tip={reason ? t(language, 'rediseno.reason.disabled', { reason }) : name}
        description={reason}
        shortcut={shortcut?.label.replace('Ctrl', MOD_LABEL)}
        keys={shortcut?.keys}
        disabled={!availability.enabled}
        onSelect={pick(() => runAction(id))}
      />
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`kura-btn kura-btn-sm kura-actions-trigger${open ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            toggle();
          }
        }}
        {...helpAttrs('top.actions', language)}
      >
        <Zap size={13} aria-hidden="true" />
        {showLabel && <span className="kura-btn-label">{label}</span>}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {open && anchor && typeof document !== 'undefined' &&
        createPortal(
          <div className="kura-row-menu-layer kura-actions-layer">
            <MenuSurface x={anchor.x} y={anchor.y} label={label}>
              {ACTION_GROUPS.map((group) => (
                <MenuGroup key={group.id} title={t(language, `rediseno.actions.group.${group.id}` as TranslationKey)}>
                  {group.items.map((id) => item(id))}
                </MenuGroup>
              ))}
            </MenuSurface>
          </div>,
          document.body,
        )}
    </>
  );
};

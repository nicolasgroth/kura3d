/**
 * @file src/components/scene/SceneObjectList.tsx
 * @description Lista de objetos de la escena como `listbox` multiselección operable con teclado:
 * flechas (Inicio/Fin), Shift para rango, Ctrl para mover el foco sin seleccionar, Espacio para alternar,
 * Ctrl+A todo, Supr eliminar, F2 renombrar (Enter confirma, Esc cancela). Con ratón: clic, Ctrl+clic y
 * Shift+clic. Cada fila muestra el nombre completo en el tooltip y anuncia su estado (oculto, bloqueado,
 * hueco) sin depender solo del ícono o el color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { matchSceneObjects } from '../../store/slices/quickActionsSlice';
import { REQUEST_FRESH_MS } from './SceneSearch';
import '../../styles/sceneList.css';
import '../../styles/splitJoints.css';

const MAX_NAME = 80;

export const SceneObjectList: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const allObjects = useKuraStore((s) => s.objects);
  const sceneFilter = useKuraStore((s) => s.sceneFilter);
  const renameRequest = useKuraStore((s) => s.renameRequest);
  const objects = useMemo(() => matchSceneObjects(allObjects, sceneFilter), [allObjects, sceneFilter]);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setSelection = useKuraStore((s) => s.setSelection);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);
  const deleteObjects = useKuraStore((s) => s.deleteObjects);

  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const renameDone = useRef(false);

  // El elemento activo siempre existe: si se borró, pasa al primero seleccionado o al primero.
  const active = objects.find((o) => o.id === activeId)
    ?? objects.find((o) => selectedIds.includes(o.id))
    ?? objects[0];
  const activeIndex = active ? objects.indexOf(active) : -1;
  const optionId = (id: string) => `${baseId}-opt-${id}`;

  useEffect(() => {
    if (active) document.getElementById(optionId(active.id))?.scrollIntoView({ block: 'nearest' });
    // Solo al cambiar el elemento activo; `optionId` se recrea en cada render sin cambiar de valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  const rangeIds = (fromId: string | null, toIndex: number) => {
    const from = Math.max(0, objects.findIndex((o) => o.id === fromId));
    const [a, b] = from <= toIndex ? [from, toIndex] : [toIndex, from];
    return objects.slice(a, b + 1).map((o) => o.id);
  };

  const toggle = (id: string) =>
    setSelection(selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]);

  const focusIndex = (index: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    const target = objects[Math.max(0, Math.min(objects.length - 1, index))];
    if (!target) return;
    setActiveId(target.id);
    if (e.shiftKey) {
      setSelection(rangeIds(anchorId ?? active?.id ?? target.id, objects.indexOf(target)));
    } else if (!(e.ctrlKey || e.metaKey)) {
      setSelection([target.id]);
      setAnchorId(target.id);
    }
  };

  const startRename = (id: string) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.locked) return;
    renameDone.current = false;
    setRenamingId(id);
    setDraft(obj.name);
  };

  // F2 global (o menú contextual): renombra en línea el objeto pedido.
  useEffect(() => {
    if (!renameRequest || Date.now() - renameRequest.at > REQUEST_FRESH_MS) return;
    const { id } = renameRequest;
    if (!objects.some((o) => o.id === id)) useKuraStore.getState().setSceneFilter('');
    setActiveId(id);
    startRename(id);
    // Solo reacciona a una petición nueva (`renameRequest.n`), no a cada cambio de la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameRequest?.n]);

  // Al abrir el campo de renombrado: foco y todo el texto seleccionado (escribir reemplaza el nombre).
  const focusRenameField = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const cancelRename = () => {
    renameDone.current = true;
    setRenamingId(null);
    listRef.current?.focus();
  };

  const commitRename = () => {
    if (renameDone.current) return; // Enter o Escape ya cerraron el campo; el blur posterior no repite.
    renameDone.current = true;
    const name = draft.trim().slice(0, MAX_NAME);
    const obj = objects.find((o) => o.id === renamingId);
    if (obj && name && name !== obj.name) updateObjectMeta(obj.id, { name });
    setRenamingId(null);
    listRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (renamingId || !active) return;
    const mods = { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey };
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'ArrowDown':
        handled();
        focusIndex(activeIndex + 1, mods);
        break;
      case 'ArrowUp':
        handled();
        focusIndex(activeIndex - 1, mods);
        break;
      case 'Home':
        handled();
        focusIndex(0, mods);
        break;
      case 'End':
        handled();
        focusIndex(objects.length - 1, mods);
        break;
      case ' ':
        handled();
        if (e.shiftKey) setSelection(rangeIds(anchorId ?? active.id, activeIndex));
        else {
          toggle(active.id);
          setAnchorId(active.id);
        }
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          handled();
          setSelection(objects.map((o) => o.id));
        }
        break;
      case 'Delete':
      case 'Backspace': {
        handled();
        const ids = selectedIds.filter((id) => !objects.find((o) => o.id === id)?.locked);
        if (ids.length) deleteObjects(ids);
        break;
      }
      case 'F2':
        handled();
        startRename(active.id);
        break;
      case 'Escape':
        if (selectedIds.length) {
          handled();
          setSelection([]);
        }
        break;
      default:
        break;
    }
  };

  const handleClick = (e: React.MouseEvent, id: string) => {
    // Toda la fila selecciona, salvo los botones de acción (agrupados a la derecha).
    if ((e.target as HTMLElement).closest('button')) return;
    const index = objects.findIndex((o) => o.id === id);
    setActiveId(id);
    if (e.shiftKey) {
      setSelection(rangeIds(anchorId ?? active?.id ?? id, index));
    } else if (e.ctrlKey || e.metaKey) {
      toggle(id);
      setAnchorId(id);
    } else {
      setSelection([id]);
      setAnchorId(id);
    }
  };

  return (
    <>
    <div
      ref={listRef}
      className="kura-scene-list"
      role="listbox"
      aria-multiselectable="true"
      aria-keyshortcuts="F2"
      aria-label={t(language, 'sidebar.scene.listLabel')}
      aria-describedby={`${baseId}-hint`}
      aria-activedescendant={active ? optionId(active.id) : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {objects.map((obj) => {
        const isSelected = selectedIds.includes(obj.id);
        const isActive = active?.id === obj.id;
        const states = [
          !obj.visible && t(language, 'sidebar.scene.stateHidden'),
          obj.locked && t(language, 'sidebar.scene.stateLocked'),
          obj.isHole && t(language, 'sidebar.scene.holeBadge'),
        ].filter(Boolean);
        return (
          <div
            key={obj.id}
            id={optionId(obj.id)}
            role="option"
            aria-selected={isSelected}
            title={obj.name}
            className={`kura-scene-item ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active-option' : ''}`}
            onClick={(e) => handleClick(e, obj.id)}
            onDoubleClick={() => startRename(obj.id)}
          >
            <div className="kura-scene-item-main">
              <span className="kura-color-dot" aria-hidden="true" style={{ backgroundColor: obj.isHole ? '#f97316' : obj.color }} />
              {renamingId === obj.id ? (
                <input
                  className="kura-input kura-scene-rename"
                  value={draft}
                  maxLength={MAX_NAME}
                  ref={focusRenameField}
                  aria-label={t(language, 'sidebar.scene.renameLabel')}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    else if (e.key === 'Escape') cancelRename();
                  }}
                />
              ) : (
                <span className="kura-scene-name" title={obj.name}>{obj.name}</span>
              )}
              {obj.metadata?.split?.assemblyStep != null && (
                <span className="kura-step-tag" title={t(language, 'splitJoints.order.title')}>
                  <span className="sr-only">{t(language, 'splitJoints.order.badge', { n: obj.metadata.split.assemblyStep })}</span>
                  <span aria-hidden="true">{obj.metadata.split.assemblyStep}</span>
                </span>
              )}
              {obj.isHole && <span className="kura-hole-tag" aria-hidden="true">{t(language, 'sidebar.scene.holeBadge')}</span>}
              {states.length > 0 && <span className="sr-only">, {states.join(', ')}</span>}
            </div>

            {/* Acciones de ratón; con teclado: Supr, F2, Ctrl+D y L (atajos globales). */}
            <div className="kura-scene-actions" aria-hidden="true">
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.toggleVisible')} onClick={() => updateObjectMeta(obj.id, { visible: !obj.visible })}>
                {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.toggleLock')} onClick={() => updateObjectMeta(obj.id, { locked: !obj.locked })}>
                {obj.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.dropToBed')} onClick={() => dropObjectToBed(obj.id)}>
                <ArrowDownToLine size={13} />
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.duplicate')} onClick={() => duplicateObjects([obj.id])}>
                <Copy size={13} />
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.delete')} disabled={obj.locked} onClick={() => deleteObjects([obj.id])}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
    <p id={`${baseId}-hint`} className="kura-scene-hint">{t(language, 'sidebar.scene.keyboardHint')}</p>
    </>
  );
};

/**
 * @file src/components/scene/SceneObjectList.tsx
 * @description Árbol de la escena como capas (`tree` multiselección): grupos anidados con sangría, piezas de
 * una división bajo un nodo plegable, ojo y candado por fila (en un grupo aplican a todo) y búsqueda que
 * muestra los ancestros de lo encontrado. Teclado: ↑/↓ mueven, Inicio/Fin, → despliega o entra, ← pliega o
 * sube al padre, Shift para rango, Ctrl mueve el foco sin seleccionar, Enter selecciona, Espacio alterna,
 * Ctrl+A todo, Supr elimina (un grupo pide confirmación), F2 o doble clic en el nombre renombra, Mayús+H
 * oculta/muestra, Mayús+L bloquea, Alt+↑/↓ reordena, Alt+→ mete en el grupo de arriba (lo despliega y el
 * foco sigue en lo movido) y Alt+← saca. Con ratón: clic, Ctrl+clic, Shift+clic y arrastrar y soltar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { t } from '../../i18n';
import { buildSceneTree, descendantObjectIds, type TreeKey } from '../../core/scene/groups';
import { useKuraStore } from '../../store/useKuraStore';
import { matchSceneObjects } from '../../store/slices/quickActionsSlice';
import { REQUEST_FRESH_MS } from './SceneSearch';
import { useContextMenuRequest } from '../../store/contextMenuRequest';
import { SceneTreeRow, type DropPlace } from './SceneTreeRow';
import { visibleTreeRows, type TreeRow } from './sceneTreeRows';
import { confirmDeleteSelection } from './confirmDeleteSelection';
import '../../styles/sceneList.css';
import '../../styles/sceneTree.css';
import '../../styles/splitJoints.css';

const MAX_NAME = 80;

export const SceneObjectList: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const allObjects = useKuraStore((s) => s.objects);
  const groups = useKuraStore((s) => s.groups);
  const groupContextId = useKuraStore((s) => s.groupContextId);
  const sceneFilter = useKuraStore((s) => s.sceneFilter);
  const renameRequest = useKuraStore((s) => s.renameRequest);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const setSelection = useKuraStore((s) => s.setSelection);
  const updateObjectMeta = useKuraStore((s) => s.updateObjectMeta);
  const duplicateObjects = useKuraStore((s) => s.duplicateObjects);
  const dropObjectToBed = useKuraStore((s) => s.dropObjectToBed);

  const [collapsedSplits, setCollapsedSplits] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => buildSceneTree(allObjects, groups), [allObjects, groups]);
  const matches = useMemo(() => {
    if (!sceneFilter.trim()) return null;
    return new Set(matchSceneObjects(allObjects, sceneFilter).map((o) => o.id));
  }, [allObjects, sceneFilter]);
  const rows = useMemo(() => visibleTreeRows(tree, collapsedSplits, matches), [tree, collapsedSplits, matches]);

  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [activeKey, setActiveKey] = useState<TreeKey | null>(null);
  const [anchorKey, setAnchorKey] = useState<TreeKey | null>(null);
  const [renamingKey, setRenamingKey] = useState<TreeKey | null>(null);
  const [draft, setDraft] = useState('');
  const [drop, setDrop] = useState<{ key: TreeKey; place: DropPlace } | null>(null);
  const dragKey = useRef<TreeKey | null>(null);
  const renameDone = useRef(false);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isRowSelected = (row: TreeRow) => row.objectIds.length > 0 && row.objectIds.every((id) => selected.has(id));
  // La fila activa siempre existe: si se borró, pasa a la primera seleccionada o a la primera.
  const active = rows.find((r) => r.key === activeKey) ?? rows.find(isRowSelected) ?? rows[0];
  const activeIndex = active ? rows.indexOf(active) : -1;
  const rowId = (key: string) => `${baseId}-row-${key.replace(/[^\w-]/g, '_')}`;

  useEffect(() => {
    if (active) document.getElementById(rowId(active.key))?.scrollIntoView({ block: 'nearest' });
    // Solo al cambiar la fila activa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  const selectRow = (row: TreeRow) => {
    setSelection(row.objectIds);
    // El contexto queda en el grupo que contiene la fila: Escape sale un nivel.
    useKuraStore.setState({ groupContextId: row.node.kind === 'object' ? row.node.object.groupRef ?? null : row.parentGroupId });
  };
  const rangeIds = (fromKey: TreeKey | null, toIndex: number) => {
    const from = Math.max(0, rows.findIndex((r) => r.key === fromKey));
    const [a, b] = from <= toIndex ? [from, toIndex] : [toIndex, from];
    return [...new Set(rows.slice(a, b + 1).flatMap((r) => r.objectIds))];
  };
  const toggleRow = (row: TreeRow) =>
    setSelection(isRowSelected(row) ? selectedIds.filter((s) => !row.objectIds.includes(s)) : [...selectedIds, ...row.objectIds]);

  const focusIndex = (index: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!target) return;
    setActiveKey(target.key);
    if (e.shiftKey) setSelection(rangeIds(anchorKey ?? active?.key ?? target.key, rows.indexOf(target)));
    else if (!(e.ctrlKey || e.metaKey)) {
      selectRow(target);
      setAnchorKey(target.key);
    }
  };

  const setExpanded = (row: TreeRow, expanded: boolean) => {
    if (row.node.kind === 'group') useKuraStore.getState().setGroupCollapsed(row.node.group.id, !expanded);
    else if (row.node.kind === 'split') {
      const key = row.key;
      setCollapsedSplits((prev) => {
        const next = new Set(prev);
        if (expanded) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  };

  const startRename = (row: TreeRow) => {
    if (row.node.kind === 'split') return;
    if (row.node.kind === 'object' ? row.node.object.locked : row.node.group.locked) return;
    renameDone.current = false;
    setRenamingKey(row.key);
    setDraft(row.node.kind === 'object' ? row.node.object.name : row.node.group.name);
  };

  // F2 global (o menú contextual): renombra en línea el objeto o el grupo pedido.
  useEffect(() => {
    if (!renameRequest || Date.now() - renameRequest.at > REQUEST_FRESH_MS) return;
    const isGroup = Boolean(renameRequest.group);
    const key = `${isGroup ? 'g' : 'o'}:${renameRequest.id}` as TreeKey;
    let row = rows.find((r) => r.key === key);
    if (!row) {
      const st = useKuraStore.getState();
      st.setSceneFilter('');
      // Despliega los grupos que lo contienen para que la fila exista.
      let gid = isGroup ? st.groups.find((g) => g.id === renameRequest.id)?.parentId : st.objects.find((o) => o.id === renameRequest.id)?.groupRef;
      while (gid) {
        st.setGroupCollapsed(gid, false);
        gid = st.groups.find((g) => g.id === gid)?.parentId;
      }
      const fresh = useKuraStore.getState();
      const base = { key, level: 1, parentGroupId: null, parentKey: null, posInSet: 1, setSize: 1 };
      if (isGroup) {
        const g = fresh.groups.find((x) => x.id === renameRequest.id);
        if (g) row = { ...base, node: { kind: 'group', key, group: g, level: 1, children: [], objectCount: 0 }, objectIds: [] };
      } else {
        const o = fresh.objects.find((x) => x.id === renameRequest.id);
        if (o) row = { ...base, node: { kind: 'object', key, object: o, level: 1 }, objectIds: [o.id] };
      }
    }
    setActiveKey(key);
    if (row) startRename(row);
    // Solo reacciona a una petición nueva (`renameRequest.n`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameRequest?.n]);

  const focusRenameField = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const cancelRename = () => {
    renameDone.current = true;
    setRenamingKey(null);
    listRef.current?.focus();
  };

  const commitRename = () => {
    if (renameDone.current) return; // Enter o Escape ya cerraron el campo; el blur posterior no repite.
    renameDone.current = true;
    const name = draft.trim().slice(0, MAX_NAME);
    const key = renamingKey;
    setRenamingKey(null);
    listRef.current?.focus();
    if (!key || !name) return;
    if (key.startsWith('o:')) {
      const obj = allObjects.find((o) => o.id === key.slice(2));
      if (obj && name !== obj.name) updateObjectMeta(obj.id, { name });
    } else if (key.startsWith('g:')) useKuraStore.getState().renameGroup(key.slice(2), name);
  };

  const toggleVisible = (row: TreeRow) => {
    if (row.node.kind === 'group') useKuraStore.getState().setGroupFlag(row.node.group.id, 'visible', !row.node.group.visible);
    else if (row.node.kind === 'object') updateObjectMeta(row.node.object.id, { visible: !row.node.object.visible });
  };
  const toggleLock = (row: TreeRow) => {
    if (row.node.kind === 'group') useKuraStore.getState().setGroupFlag(row.node.group.id, 'locked', !row.node.group.locked);
    else if (row.node.kind === 'object') updateObjectMeta(row.node.object.id, { locked: !row.node.object.locked });
  };

  /**
   * Tras meter o sacar un nodo por teclado: despliega los grupos que ahora lo contienen y deja el foco
   * y la selección en el nodo movido.
   */
  const revealMoved = (key: TreeKey) => {
    const st = useKuraStore.getState();
    let gid = key.startsWith('g:')
      ? st.groups.find((g) => g.id === key.slice(2))?.parentId
      : st.objects.find((o) => o.id === key.slice(2))?.groupRef;
    while (gid) {
      st.setGroupCollapsed(gid, false);
      gid = st.groups.find((g) => g.id === gid)?.parentId;
    }
    const fresh = useKuraStore.getState();
    const ids = key.startsWith('g:') ? descendantObjectIds(fresh.objects, fresh.groups, key.slice(2)) : key.startsWith('o:') ? [key.slice(2)] : null;
    if (ids) setSelection(ids);
    setActiveKey(key);
    setAnchorKey(key);
    listRef.current?.focus();
  };

  /** Abre el menú del objeto de la fila (selecciona el objeto si no lo estaba). Los grupos no tienen menú. */
  const openRowMenu = (row: TreeRow, x: number, y: number, returnFocus: HTMLElement | null) => {
    if (row.node.kind !== 'object') return;
    const id = row.node.object.id;
    if (!useKuraStore.getState().selectedIds.includes(id)) setSelection([id]);
    setActiveKey(row.key);
    useContextMenuRequest.getState().open({ objectId: id, x, y, returnFocus });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (renamingKey || !active) return;
    const mods = { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey };
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const st = useKuraStore.getState();
    // Menú contextual de la fila activa: tecla Menú o Mayús+F10.
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      handled();
      const rowEl = document.getElementById(rowId(active.key));
      const box = rowEl?.getBoundingClientRect();
      openRowMenu(active, box ? box.left + 32 : 8, box ? box.bottom : 8, listRef.current);
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const key = active.key;
      const ok =
        e.key === 'ArrowUp' ? st.reorderSceneNode(key, -1)
          : e.key === 'ArrowDown' ? st.reorderSceneNode(key, 1)
            : e.key === 'ArrowRight' ? st.indentSceneNode(key)
              : e.key === 'ArrowLeft' ? st.outdentSceneNode(key)
                : null;
      if (ok !== null) {
        handled();
        if (ok) revealMoved(key);
      }
      return;
    }
    // Acciones de la fila activa (también son botones en la fila): Mayús+H ojo, Mayús+L candado.
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === 'H' || e.key === 'h' || e.key === 'L' || e.key === 'l')) {
      handled();
      if (e.key.toLowerCase() === 'h') toggleVisible(active);
      else toggleLock(active);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        handled();
        focusIndex(activeIndex + 1, mods);
        break;
      case 'ArrowUp':
        handled();
        focusIndex(activeIndex - 1, mods);
        break;
      case 'ArrowRight':
        handled();
        if (active.expanded === false) setExpanded(active, true);
        else if (active.expanded) focusIndex(activeIndex + 1, mods);
        break;
      case 'ArrowLeft': {
        handled();
        if (active.expanded) setExpanded(active, false);
        else if (active.parentKey) focusIndex(rows.findIndex((r) => r.key === active.parentKey), mods);
        break;
      }
      case 'Home':
        handled();
        focusIndex(0, mods);
        break;
      case 'End':
        handled();
        focusIndex(rows.length - 1, mods);
        break;
      case 'Enter':
        // Enter selecciona la fila activa (plegar y desplegar van con ←/→).
        handled();
        selectRow(active);
        setAnchorKey(active.key);
        break;
      case ' ':
        handled();
        if (e.shiftKey) setSelection(rangeIds(anchorKey ?? active.key, activeIndex));
        else {
          toggleRow(active);
          setAnchorKey(active.key);
        }
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          handled();
          setSelection(allObjects.map((o) => o.id));
        }
        break;
      case 'Delete':
      case 'Backspace': {
        handled();
        const ids = selectedIds.filter((id) => !allObjects.find((o) => o.id === id)?.locked);
        if (ids.length) void confirmDeleteSelection(ids);
        break;
      }
      case 'F2':
        handled();
        startRename(active);
        break;
      case 'Escape':
        if (selectedIds.length) {
          handled();
          setSelection([]);
          useKuraStore.setState({ groupContextId: null });
        }
        break;
      default:
        break;
    }
  };

  // Fila donde empezó un doble clic: el doble clic renombra esa fila aunque el segundo clic caiga en
  // otra (p. ej. si la lista se movió entre clics), y ese segundo clic no cambia la selección.
  const clickStart = useRef<TreeKey | null>(null);
  const handleClick = (e: React.MouseEvent, row: TreeRow) => {
    if (e.detail >= 2 && clickStart.current && clickStart.current !== row.key) return;
    if (e.detail <= 1) clickStart.current = row.key;
    const index = rows.indexOf(row);
    setActiveKey(row.key);
    if (e.shiftKey) setSelection(rangeIds(anchorKey ?? active?.key ?? row.key, index));
    else if (e.ctrlKey || e.metaKey) {
      toggleRow(row);
      setAnchorKey(row.key);
    } else {
      selectRow(row);
      setAnchorKey(row.key);
    }
  };

  // Arrastrar y soltar: arriba/abajo de la fila = antes/después; en el centro de un grupo = dentro.
  const dragHandlers = (row: TreeRow) => ({
    onDragStart: (e: React.DragEvent) => {
      dragKey.current = row.key;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.key);
    },
    onDragOver: (e: React.DragEvent) => {
      const from = dragKey.current;
      if (!from || from === row.key) return;
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = (e.clientY - rect.top) / Math.max(1, rect.height);
      const place: DropPlace = row.node.kind === 'group' && y > 0.25 && y < 0.75 ? 'inside' : y < 0.5 ? 'before' : 'after';
      if (drop?.key !== row.key || drop.place !== place) setDrop({ key: row.key, place });
    },
    onDragLeave: () => setDrop((d) => (d?.key === row.key ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragKey.current;
      const place = drop?.key === row.key ? drop.place : null;
      setDrop(null);
      dragKey.current = null;
      if (!from || !place || from === row.key) return;
      const st = useKuraStore.getState();
      if (place === 'inside' && row.node.kind === 'group') st.moveSceneNode(from, row.node.group.id, null);
      else if (place === 'before') st.moveSceneNode(from, row.parentGroupId, row.key);
      else {
        // Después: antes del siguiente hermano de la fila (o al final de su grupo).
        const siblings = rows.filter((r) => r.parentKey === row.parentKey);
        const next = siblings[siblings.indexOf(row) + 1];
        st.moveSceneNode(from, row.parentGroupId, next ? next.key : null);
      }
      setActiveKey(from);
    },
    onDragEnd: () => {
      dragKey.current = null;
      setDrop(null);
    },
  });

  const contextGroup = groupContextId ? groups.find((g) => g.id === groupContextId) : null;
  const splitName = (splitGroupId: string) => {
    const piece = allObjects.find((o) => o.metadata?.split?.groupId === splitGroupId);
    return piece ? piece.name.replace(/\s*[A-Z]+\d+[a-z]*$/, '') || piece.name : splitGroupId;
  };

  return (
    <>
      <div
        ref={listRef}
        className="kura-scene-list kura-scene-tree"
        role="tree"
        aria-multiselectable="true"
        aria-keyshortcuts="F2 Shift+F10 ContextMenu Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight Alt+ArrowLeft"
        aria-label={t(language, 'sidebar.scene.listLabel')}
        aria-describedby={`${baseId}-hint`}
        aria-activedescendant={active ? rowId(active.key) : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {rows.map((row) => (
          <SceneTreeRow
            key={row.key}
            row={row}
            id={rowId(row.key)}
            language={language}
            selected={isRowSelected(row)}
            active={active?.key === row.key}
            renaming={renamingKey === row.key}
            draft={draft}
            dropPlace={drop?.key === row.key ? drop.place : null}
            splitName={row.node.kind === 'split' ? splitName(row.node.splitGroupId) : undefined}
            onDraft={setDraft}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onRenameField={focusRenameField}
            onClick={(e) => handleClick(e, row)}
            onContextMenu={(x, y) => openRowMenu(row, x, y, listRef.current)}
            onDoubleClick={() => {
              const start = rows.find((r) => r.key === clickStart.current) ?? row;
              setActiveKey(start.key);
              startRename(start);
            }}
            onToggleExpand={() => setExpanded(row, !row.expanded)}
            onToggleVisible={() => toggleVisible(row)}
            onToggleLock={() => toggleLock(row)}
            onDropToBed={(o) => dropObjectToBed(o.id)}
            onDuplicate={(o) => duplicateObjects([o.id])}
            onDelete={(o) => void confirmDeleteSelection([o.id])}
            dragHandlers={dragHandlers(row)}
          />
        ))}
      </div>
      {/* Bajo el árbol: al entrar o salir de un grupo las filas no se desplazan entre clics. */}
      {contextGroup && (
        <div className="kura-tree-context" role="status">
          <span>{t(language, 'groups.tree.inside', { name: contextGroup.name })}</span>
          <button type="button" className="kura-mini-icon-btn" title={t(language, 'groups.tree.exit')} aria-label={t(language, 'groups.tree.exit')} aria-keyshortcuts="Escape" onClick={() => useKuraStore.getState().exitGroup()}>
            <LogOut size={13} aria-hidden="true" />
          </button>
        </div>
      )}
      <p id={`${baseId}-hint`} className="kura-scene-hint">
        {t(language, 'sidebar.scene.keyboardHint')} · {t(language, 'groups.tree.hint')}
      </p>
    </>
  );
};

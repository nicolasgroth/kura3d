/**
 * @file src/components/scene/SceneTreeRow.tsx
 * @description Una fila del árbol de la escena (`treeitem`): sangría por nivel, flecha para plegar,
 * icono por tipo (grupo, sólido, negativo, texto, pieza de división, combinado), nombre o campo de
 * renombrar, contador de miembros y botones de ojo y candado (en un grupo aplican a todo). Los estados
 * se anuncian en texto, no solo con icono o color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import {
  ArrowDownToLine, Box, Boxes, ChevronDown, ChevronRight, Copy, Eye, EyeOff, Folder, FolderOpen, Lock, MinusSquare,
  Puzzle, Trash2, Type, Unlock,
} from 'lucide-react';
import { t } from '../../i18n';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { tCount } from '../../utils/plural';
import type { TreeRow } from './sceneTreeRows';

export type DropPlace = 'before' | 'after' | 'inside';

export interface SceneTreeRowProps {
  row: TreeRow;
  id: string;
  language: LanguageCode;
  selected: boolean;
  active: boolean;
  renaming: boolean;
  draft: string;
  dropPlace: DropPlace | null;
  /** Nombre que se muestra en un nodo de división ("División de …"). */
  splitName?: string;
  onDraft: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRenameField: (el: HTMLInputElement | null) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onToggleExpand: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onDropToBed: (obj: SceneObject) => void;
  onDuplicate: (obj: SceneObject) => void;
  onDelete: (obj: SceneObject) => void;
  dragHandlers: Pick<React.HTMLAttributes<HTMLDivElement>, 'onDragStart' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd'>;
}

function typeOf(row: TreeRow): { icon: React.ReactNode; label: string } {
  const node = row.node;
  if (node.kind === 'group') {
    return { icon: row.expanded ? <FolderOpen size={14} /> : <Folder size={14} />, label: 'groups.tree.type.group' };
  }
  if (node.kind === 'split') return { icon: <Puzzle size={14} />, label: 'groups.tree.type.split' };
  const o = node.object;
  if (o.isHole) return { icon: <MinusSquare size={14} />, label: 'groups.tree.type.negative' };
  if (o.metadata?.split) return { icon: <Puzzle size={14} />, label: 'groups.tree.type.split' };
  if (o.primitiveType === 'text') return { icon: <Type size={14} />, label: 'groups.tree.type.text' };
  if (o.source === 'combined') return { icon: <Boxes size={14} />, label: 'groups.tree.type.combined' };
  return { icon: <Box size={14} />, label: 'groups.tree.type.solid' };
}

export const SceneTreeRow: React.FC<SceneTreeRowProps> = (props) => {
  const { row, id, language, selected, active, renaming, draft, dropPlace, splitName } = props;
  const node = row.node;
  const obj = node.kind === 'object' ? node.object : null;
  const group = node.kind === 'group' ? node.group : null;
  const name = obj?.name ?? group?.name ?? t(language, 'groups.tree.splitNode', { name: splitName ?? '' });
  const visible = obj ? obj.visible : group ? group.visible : true;
  const locked = obj ? obj.locked : group ? group.locked : false;
  const count = node.kind === 'object' ? 0 : node.objectCount;
  const type = typeOf(row);
  const states = [
    t(language, type.label as never),
    !visible && t(language, 'sidebar.scene.stateHidden'),
    locked && t(language, 'sidebar.scene.stateLocked'),
    count > 0 && tCount(language, { one: 'groups.tree.members.one', other: 'groups.tree.members.other' }, count),
  ].filter(Boolean);
  const expandable = node.kind !== 'object';

  return (
    <div
      id={id}
      role="treeitem"
      aria-level={row.level}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-selected={selected}
      aria-expanded={expandable ? Boolean(row.expanded) : undefined}
      title={name}
      draggable={!renaming && node.kind !== 'split'}
      className={`kura-scene-item kura-tree-row ${selected ? 'is-selected' : ''} ${active ? 'is-active-option' : ''} ${dropPlace ? `is-drop-${dropPlace}` : ''}`}
      style={{ '--tree-level': row.level - 1 } as React.CSSProperties}
      onClick={props.onClick}
      onDoubleClick={props.onDoubleClick}
      {...props.dragHandlers}
    >
      <div className="kura-scene-item-main">
        {expandable ? (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="kura-tree-chevron"
            title={t(language, row.expanded ? 'groups.tree.collapse' : 'groups.tree.expand')}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleExpand();
            }}
          >
            {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="kura-tree-chevron-space" aria-hidden="true" />
        )}
        <span className="kura-tree-icon" aria-hidden="true" style={obj && !obj.isHole ? { color: obj.color } : undefined}>
          {type.icon}
        </span>
        {renaming ? (
          <input
            className="kura-input kura-scene-rename"
            value={draft}
            maxLength={80}
            ref={props.onRenameField}
            aria-label={t(language, group ? 'groups.tree.renameGroup' : 'sidebar.scene.renameLabel')}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => props.onDraft(e.target.value)}
            onBlur={props.onCommitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') props.onCommitRename();
              else if (e.key === 'Escape') props.onCancelRename();
            }}
          />
        ) : (
          <span className="kura-scene-name" title={name}>{name}</span>
        )}
        {count > 0 && <span className="kura-tree-count" aria-hidden="true">{count}</span>}
        {obj?.metadata?.split?.assemblyStep != null && (
          <span className="kura-step-tag" title={t(language, 'splitJoints.order.title')}>
            <span className="sr-only">{t(language, 'splitJoints.order.badge', { n: obj.metadata.split.assemblyStep })}</span>
            <span aria-hidden="true">{obj.metadata.split.assemblyStep}</span>
          </span>
        )}
        {obj?.isHole && <span className="kura-hole-tag" aria-hidden="true">{t(language, 'sidebar.scene.holeBadge')}</span>}
        <span className="sr-only">, {states.join(', ')}</span>
      </div>

      {/* Acciones de ratón; con teclado: Supr, F2, Ctrl+D y L (atajos globales). */}
      {node.kind !== 'split' && (
        <div className="kura-scene-actions" aria-hidden="true">
          <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, group ? 'groups.tree.toggleVisible' : 'sidebar.scene.toggleVisible')} onClick={(e) => { e.stopPropagation(); props.onToggleVisible(); }}>
            {visible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, group ? 'groups.tree.toggleLock' : 'sidebar.scene.toggleLock')} onClick={(e) => { e.stopPropagation(); props.onToggleLock(); }}>
            {locked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
          {obj && (
            <>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.dropToBed')} onClick={(e) => { e.stopPropagation(); props.onDropToBed(obj); }}>
                <ArrowDownToLine size={13} />
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.duplicate')} onClick={(e) => { e.stopPropagation(); props.onDuplicate(obj); }}>
                <Copy size={13} />
              </button>
              <button type="button" tabIndex={-1} className="kura-mini-icon-btn" title={t(language, 'sidebar.scene.delete')} disabled={obj.locked} onClick={(e) => { e.stopPropagation(); props.onDelete(obj); }}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * @file src/components/scene/sceneTreeRows.ts
 * @description Filas visibles del árbol de la escena (función pura): aplana el árbol de grupos respetando
 * lo plegado y, con búsqueda, muestra solo lo encontrado con sus ancestros (desplegados).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { nodeObjectIds, type SceneTreeNode, type TreeKey } from '../../core/scene/groups';

export interface TreeRow {
  node: SceneTreeNode;
  key: TreeKey;
  level: number;
  /** Grupo real que contiene la fila (null = raíz; el nodo de división no cuenta). */
  parentGroupId: string | null;
  /** Clave de la fila padre (grupo o división), para ← y para soltar. */
  parentKey: TreeKey | null;
  expanded?: boolean;
  /** Objetos que representa la fila (uno si es objeto). */
  objectIds: string[];
  posInSet: number;
  setSize: number;
}

/**
 * @param collapsedSplits claves de nodos de división plegados (estado local de la vista).
 * @param matches IDs encontrados por la búsqueda (null = sin búsqueda).
 */
export function visibleTreeRows(
  tree: readonly SceneTreeNode[],
  collapsedSplits: ReadonlySet<string>,
  matches: ReadonlySet<string> | null,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: readonly SceneTreeNode[], level: number, parentGroupId: string | null, parentKey: TreeKey | null) => {
    const shown = matches ? nodes.filter((n) => nodeObjectIds(n).some((id) => matches.has(id))) : nodes;
    shown.forEach((node, i) => {
      const objectIds = nodeObjectIds(node);
      const base = { node, key: node.key, level, parentGroupId, parentKey, objectIds, posInSet: i + 1, setSize: shown.length };
      if (node.kind === 'object') {
        rows.push(base);
        return;
      }
      const collapsed = node.kind === 'group' ? node.group.collapsed : collapsedSplits.has(node.key);
      // Con búsqueda, los ancestros de lo encontrado se muestran desplegados.
      const expanded = matches ? true : !collapsed;
      rows.push({ ...base, expanded });
      if (expanded) walk(node.children, level + 1, node.kind === 'group' ? node.group.id : parentGroupId, node.key);
    });
  };
  walk(tree, 1, null, null);
  return rows;
}

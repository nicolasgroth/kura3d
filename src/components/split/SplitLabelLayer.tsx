/**
 * @file src/components/split/SplitLabelLayer.tsx
 * @description Capa HTML de rótulos del visor de Dividir (códigos de pieza y "Placa N"): cada rótulo mira
 * siempre a la cámara, tiene tamaño acotado, se coloca sobre la pieza, se oculta si la pieza es muy chica en
 * pantalla o si choca con otro, y los de placa se mantienen dentro del cuadro. Se reparten cada fotograma
 * con `layoutLabels` y se mueven con el DOM directamente (sin renderizar React por fotograma).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../types/kura';
import { layoutLabels, type ProjectedLabel } from './splitLabelLayout';
import '../../styles/splitLabels.css';

export interface SplitLabelItem {
  id: string;
  text: string;
  /** Anclaje en el mundo (ejes del motor): centro de la cara superior de la pieza. */
  anchor: Vec3;
  /** Radio de la esfera que envuelve la pieza (mm), para su tamaño aparente. */
  radiusMm: number;
  kind: 'piece' | 'plate' | 'plane';
  /** Plano sin espacio para conector (rótulo de aviso). */
  noJoint?: boolean;
  /** Texto añadido ("↻ acostada") y su ayuda. */
  extra?: string;
  title?: string;
  /** Atenuado mientras el plan se recalcula. */
  dimmed?: boolean;
}

export const SplitLabelLayer: React.FC<{ items: SplitLabelItem[] }> = ({ items }) => {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const container = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, { el: HTMLSpanElement; w: number; h: number }>());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Solo cambia lo que se ve (texto, tipo, atenuado), no la posición: así la animación de explosión no remide.
  const signature = useMemo(() => items.map((i) => `${i.id}|${i.kind}|${i.noJoint ? 1 : 0}|${i.text}|${i.extra ?? ''}|${i.title ?? ''}|${i.dimmed ? 1 : 0}`).join(';'), [items]);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), r: new THREE.Vector3(), right: new THREE.Vector3() }), []);

  // Contenedor único sobre el lienzo, sin recibir clics.
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const div = document.createElement('div');
    div.className = 'kura-split-label-layer';
    div.setAttribute('data-testid', 'split-label-layer');
    parent.appendChild(div);
    container.current = div;
    const map = nodes.current;
    return () => {
      map.clear();
      div.remove();
      container.current = null;
    };
  }, [gl]);

  // Un `span` por rótulo; se recrea solo si cambia su contenido.
  useEffect(() => {
    const div = container.current;
    if (!div) return;
    const map = nodes.current;
    const list = itemsRef.current;
    const keep = new Set(list.map((i) => i.id));
    for (const [id, n] of map) {
      if (!keep.has(id)) {
        n.el.remove();
        map.delete(id);
      }
    }
    for (const item of list) {
      let node = map.get(item.id);
      if (!node) {
        const el = document.createElement('span');
        div.appendChild(el);
        node = { el, w: 0, h: 0 };
        map.set(item.id, node);
      }
      const { el } = node;
      el.className = item.kind === 'plate' ? 'kura-split-plate-tag kura-split-label' : item.kind === 'plane' ? 'kura-split-plane-tag kura-split-label' : 'kura-split-piece-tag kura-split-label';
      if (item.noJoint) el.setAttribute('data-no-joint', 'true');
      else el.removeAttribute('data-no-joint');
      el.textContent = item.text;
      if (item.extra) {
        const sub = document.createElement('span');
        sub.className = 'kura-split-piece-rot';
        sub.textContent = ` ${item.extra}`;
        el.appendChild(sub);
        el.setAttribute('data-rotated', 'true');
      } else {
        el.removeAttribute('data-rotated');
      }
      if (item.title) el.title = item.title;
      else el.removeAttribute('title');
      el.setAttribute('data-label-id', item.id);
      el.dataset.dimmed = item.dimmed ? 'true' : '';
      el.style.display = 'none';
      node.w = 0; // se vuelve a medir con el nuevo texto
    }
    // `signature` resume los datos visibles de `itemsRef`.
  }, [signature]);

  useFrame(({ size }) => {
    const map = nodes.current;
    if (map.size === 0) return;
    camera.updateMatrixWorld();
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const projected: ProjectedLabel[] = [];
    for (const item of itemsRef.current) {
      const node = map.get(item.id);
      if (!node) continue;
      if (node.w === 0) {
        // Se mide una sola vez mostrándolo fuera de cuadro; el reparto lo coloca o lo oculta enseguida.
        node.el.style.display = 'block';
        node.el.style.visibility = 'hidden';
        node.w = node.el.offsetWidth;
        node.h = node.el.offsetHeight;
      }
      tmp.v.set(item.anchor[0], item.anchor[1], item.anchor[2]).project(camera);
      const behind = tmp.v.z > 1 || tmp.v.z < -1;
      const x = (tmp.v.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.v.y * 0.5 + 0.5) * size.height;
      tmp.r.set(item.anchor[0], item.anchor[1], item.anchor[2]).addScaledVector(tmp.right, item.radiusMm).project(camera);
      const rx = (tmp.r.x * 0.5 + 0.5) * size.width;
      const ry = (-tmp.r.y * 0.5 + 0.5) * size.height;
      projected.push({
        id: item.id,
        x,
        y,
        radiusPx: Math.hypot(rx - x, ry - y),
        w: node.w,
        h: node.h,
        pinned: item.kind === 'plate',
        rank: item.kind === 'plane' ? 2 : 1,
        behind,
      });
    }
    const placed = layoutLabels(projected, size.width, size.height);
    for (const [id, node] of map) {
      const p = placed.get(id);
      if (!p) {
        node.el.style.display = 'none';
        continue;
      }
      node.el.style.display = 'block';
      node.el.style.visibility = 'visible';
      node.el.style.transform = `translate3d(${Math.round(p.left)}px, ${Math.round(p.top)}px, 0)`;
    }
  });

  return null;
};

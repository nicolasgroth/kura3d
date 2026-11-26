/**
 * @file src/components/viewport/ReferenceMaterial.tsx
 * @description Apariencia de un objeto de referencia en el visor: relleno neutro semitransparente (sin
 * escribir profundidad, para que lo de atrás se vea) y contorno discontinuo de aristas marcadas, de modo
 * que se distingue del sólido y del negativo sin depender solo del color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Relleno gris azulado: distinto del naranja de los negativos y de los colores de filamento. */
export const REFERENCE_FILL = '#8e9bb3';
const REFERENCE_DASH = '#5b6b8c';
/** Sobre este tamaño, el contorno es la caja (las aristas de un STL denso no aportan y cuestan). */
const MAX_EDGE_TRIANGLES = 300_000;

export function ReferenceMeshMaterial({ opacity, doubleSide, clippingPlanes }: {
  opacity: number;
  doubleSide: boolean;
  clippingPlanes: THREE.Plane[] | undefined;
}) {
  return (
    <meshStandardMaterial
      key={`ref_${doubleSide ? 'clip' : 'full'}`}
      color={REFERENCE_FILL}
      transparent
      opacity={opacity}
      roughness={0.8}
      metalness={0}
      depthWrite={false}
      side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
      clippingPlanes={clippingPlanes}
    />
  );
}

/** Contorno discontinuo (aristas de más de 35°, o la caja en mallas densas). */
export function ReferenceOutline({ geometry, clippingPlanes }: {
  geometry: THREE.BufferGeometry;
  clippingPlanes: THREE.Plane[] | undefined;
}) {
  const edges = useMemo(() => {
    const triangles = (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    if (triangles <= MAX_EDGE_TRIANGLES) return new THREE.EdgesGeometry(geometry, 35);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new THREE.Box3();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z).translate(center.x, center.y, center.z);
    const out = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();
    return out;
  }, [geometry]);
  const lines = useRef<THREE.LineSegments>(null);
  useLayoutEffect(() => {
    lines.current?.computeLineDistances();
  }, [edges]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <lineSegments ref={lines} geometry={edges} renderOrder={6} raycast={() => null}>
      <lineDashedMaterial
        color={REFERENCE_DASH}
        dashSize={2}
        gapSize={1.5}
        transparent
        opacity={0.9}
        depthWrite={false}
        clippingPlanes={clippingPlanes}
      />
    </lineSegments>
  );
}

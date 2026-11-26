/**
 * @file src/components/fitCheck/FitCheckHighlight.tsx
 * @description Resaltado en el visor del par elegido en «Comprobar encaje»: contorno de la caja de cada objeto
 * (A continuo, B discontinuo), la zona de choque como caja roja translúcida (`zoneBox`) o la cota de holgura
 * como segmento entre `closest.onA` y `closest.onB` con su valor. El informe viene en ejes del usuario
 * (X derecha, Y fondo, Z altura) y se pasa a los internos de three.js (Y arriba) con `displayAxes`. Se dibuja
 * encima de las piezas, no recibe clics y no toca la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { boxForObjects, type FrameBox } from '../../core/scene/cameraFraming';
import { fromUserBox, fromUserPosition } from '../../core/scene/displayAxes';
import { t } from '../../i18n';
import { formatLocaleNumber } from '../../i18n/numberLocale';
import { useKuraStore } from '../../store/useKuraStore';
import type { Vec3 } from '../../types/kura';

const ON_TOP = 998;
const OBJECT_COLOR = '#38bdf8';
const CLASH_COLOR = '#ef4444';
const GAP_COLOR = '#f59e0b';
const noRaycast = () => null;

/** Las 12 aristas de una caja como pares de puntos (para `Line` con `segments`). */
function boxEdges(box: FrameBox): Vec3[] {
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  const c: Vec3[] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  return e.flatMap(([a, b]) => [c[a], c[b]]);
}

const BoxOutline: React.FC<{ box: FrameBox; color: string; dashed?: boolean }> = ({ box, color, dashed }) => (
  <Line
    points={boxEdges(box)}
    segments
    color={color}
    lineWidth={dashed ? 1.5 : 2}
    dashed={dashed}
    dashSize={3}
    gapSize={2}
    depthTest={false}
    transparent
    opacity={0.9}
    renderOrder={ON_TOP}
    raycast={noRaycast}
  />
);

export const FitCheckHighlight: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const highlight = useKuraStore((s) => s.fitCheckHighlight);
  const report = useKuraStore((s) => s.fitCheck?.report ?? null);
  const objects = useKuraStore((s) => s.objects);

  const view = useMemo(() => {
    if (!highlight || !report) return null;
    const pair = report.pairs.find((p) => p.aId === highlight.aId && p.bId === highlight.bId);
    if (!pair) return null;
    const a = objects.find((o) => o.id === pair.aId);
    const b = objects.find((o) => o.id === pair.bId);
    const boxA = a ? boxForObjects([a]) : null;
    const boxB = b ? boxForObjects([b]) : null;
    const zone = pair.interference ? fromUserBox(pair.interference.zoneBox) : null;
    const gap = !zone && pair.closest ? { a: fromUserPosition(pair.closest.onA), b: fromUserPosition(pair.closest.onB) } : null;
    return { pair, boxA, boxB, zone, gap };
  }, [highlight, report, objects]);

  if (!view) return null;
  const { pair, boxA, boxB, zone, gap } = view;
  const zoneSize = zone ? new THREE.Vector3(...zone.max).sub(new THREE.Vector3(...zone.min)) : null;
  const zoneCenter = zone ? new THREE.Vector3(...zone.min).add(new THREE.Vector3(...zone.max)).multiplyScalar(0.5) : null;

  return (
    <group raycast={noRaycast} name="fit-check-highlight">
      {boxA && <BoxOutline box={boxA} color={OBJECT_COLOR} />}
      {boxB && <BoxOutline box={boxB} color={OBJECT_COLOR} dashed />}
      {zone && zoneSize && zoneCenter && (
        <>
          <mesh position={zoneCenter} renderOrder={ON_TOP} raycast={noRaycast}>
            {/* Una zona plana (contacto) se engrosa un poco para que se vea. */}
            <boxGeometry args={[Math.max(zoneSize.x, 0.4), Math.max(zoneSize.y, 0.4), Math.max(zoneSize.z, 0.4)]} />
            <meshBasicMaterial color={CLASH_COLOR} transparent opacity={0.38} depthTest={false} depthWrite={false} />
          </mesh>
          <BoxOutline box={zone} color={CLASH_COLOR} />
        </>
      )}
      {gap && pair.clearanceMm !== null && (
        <>
          <Line points={[gap.a, gap.b]} color={GAP_COLOR} lineWidth={3} depthTest={false} renderOrder={ON_TOP + 1} raycast={noRaycast} />
          {[gap.a, gap.b].map((p, i) => (
            <mesh key={i} position={p} renderOrder={ON_TOP + 1} raycast={noRaycast}>
              <sphereGeometry args={[0.6, 12, 8]} />
              <meshBasicMaterial color={GAP_COLOR} depthTest={false} />
            </mesh>
          ))}
          <Html
            position={[(gap.a[0] + gap.b[0]) / 2, (gap.a[1] + gap.b[1]) / 2, (gap.a[2] + gap.b[2]) / 2]}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="kura-fitcheck-label" data-testid="fit-check-gap-label">
              {t(language, 'fitCheck.ui.label.clearance', { value: formatLocaleNumber(language, pair.clearanceMm, { maxFrac: 2, minFrac: 2 }) })}
            </span>
          </Html>
        </>
      )}
    </group>
  );
};

/**
 * @file src/components/viewport/PlateBeds.tsx
 * @description Camas del visor. Sin placas, o con una sola en el origen y la cama del proyecto, dibuja la cama de siempre (`PrinterBedOverlay`); si
 * no (varias, o una fuera del origen) dibuja una cama por placa, cada una en su origen y con su nombre, la activa resaltada y cada una
 * en rojo si sus piezas exceden SU volumen. «Solo esta» (`plateSolo`) deja solo la cama de la placa activa. El
 * botón «Sin cama» oculta todas (lo decide quien monta este componente).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { isLegacyPlateSetup, plateBed, resolveActivePlate } from '../../core/scene/plates';
import { useKuraStore } from '../../store/useKuraStore';
import { platesBedStatus } from './plateBedStatus';
import { PrinterBedOverlay } from './PrinterBedOverlay';

export const PlateBeds: React.FC<{ isOutOfBounds: boolean }> = ({ isOutOfBounds }) => {
  const plates = useKuraStore((s) => s.plates);
  const activePlateId = useKuraStore((s) => s.activePlateId);
  const plateSolo = useKuraStore((s) => s.plateSolo);
  const objects = useKuraStore((s) => s.objects);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const customBed = useKuraStore((s) => s.customBedDimensions);
  // Una sola placa fuera del origen (o con cama propia) también se dibuja por placa: la cama de siempre estaría mal puesta.
  const multi = !isLegacyPlateSetup(plates, customBed ? { widthMm: customBed.width, depthMm: customBed.depth, heightMm: customBed.height } : { widthMm: printerProfile.bedWidthMm, depthMm: printerProfile.bedDepthMm, heightMm: printerProfile.maxHeightMm });
  const statuses = useMemo(
    () => (multi ? new Map(platesBedStatus(objects, printerProfile, plates).map((e) => [e.plateId, e.status])) : null),
    [multi, objects, printerProfile, plates],
  );

  if (!multi) return <PrinterBedOverlay isOutOfBounds={isOutOfBounds} />;
  const active = resolveActivePlate(plates, activePlateId);
  const base = customBed
    ? { widthMm: customBed.width, depthMm: customBed.depth, heightMm: customBed.height }
    : { widthMm: printerProfile.bedWidthMm, depthMm: printerProfile.bedDepthMm, heightMm: printerProfile.maxHeightMm };
  return (
    <>
      {plates.filter((p) => !plateSolo || p.id === active?.id).map((p) => (
        <group key={p.id} position={[p.origin[0], 0, p.origin[1]]} name={`plate-bed:${p.id}`}>
          <PrinterBedOverlay
            isOutOfBounds={statuses?.get(p.id) === 'outOfBounds'}
            bed={plateBed(p, base)}
            title={p.name}
            active={p.id === active?.id}
          />
        </group>
      ))}
    </>
  );
};

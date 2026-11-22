/**
 * @file src/components/viewport/ViewportOverlays.tsx
 * @description Capas HTML sobre el visor: consejo, HUD inferior, barra de progreso con Cancelar,
 * barra de booleanas con vista previa, aviso de la vista de sección temporal y capas de "dividir para
 * imprimir" (panel, aviso de que no cabe y control de armado).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { BooleanPreviewBar } from './BooleanPreviewBar';
import { OperationProgressBar } from './OperationProgressBar';
import { ViewportHudBottom } from './ViewportHudBottom';
import { ViewportProTip } from './ViewportProTip';
import { SplitOverlays } from '../split/SplitOverlays';

export const ViewportOverlays: React.FC = () => (
  <>
    <ViewportProTip />
    <ViewportHudBottom />
    <BooleanPreviewBar />
    <OperationProgressBar />
    <SplitOverlays />
  </>
);

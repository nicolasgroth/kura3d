/**
 * @file src/components/viewport/ViewportOverlays.tsx
 * @description Capas HTML sobre el visor: consejo, HUD inferior, barra de progreso con Cancelar,
 * barra de booleanas con vista previa y aviso de la vista de sección temporal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { BooleanPreviewBar } from './BooleanPreviewBar';
import { OperationProgressBar } from './OperationProgressBar';
import { ViewportHudBottom } from './ViewportHudBottom';
import { ViewportProTip } from './ViewportProTip';

export const ViewportOverlays: React.FC = () => (
  <>
    <ViewportProTip />
    <ViewportHudBottom />
    <BooleanPreviewBar />
    <OperationProgressBar />
  </>
);

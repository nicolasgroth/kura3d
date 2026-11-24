/**
 * @file src/components/text3d/Text3DPanel.tsx
 * @description Panel de operación «Texto 3D» (no modal, en el lugar del inspector): lo abren «Agregar», «Insertar»
 * y la hoja «Agregar» en móvil. Contiene la tarjeta de creación (`Text3DCreateCard`, con validación y aviso de
 * cama) y se cierra al crear el texto, con su botón o con Esc.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useCallback } from 'react';
import { t } from '../../i18n';
import { setText3DPanelOpen, useText3DPanel } from '../../store/insertCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import { OperationPanel } from '../OperationPanel';
import { Text3DCreateCard } from './Text3DCreateCard';

export const Text3DPanel: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const open = useText3DPanel((s) => s.open);
  const close = useCallback(() => setText3DPanelOpen(false), []);
  return (
    <OperationPanel open={open} onClose={close} title={t(language, 'r3a.text.panel')} className="kura-text3d-panel">
      <Text3DCreateCard onCreated={close} />
    </OperationPanel>
  );
};

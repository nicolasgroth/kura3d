/**
 * @file src/components/viewport/ViewportCaptureRegistrar.tsx
 * @description Registra la captura PNG del canvas WebGL para el servidor MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { registerViewportCapture } from '../../utils/mcpBridgeClient';

/** Registra el callback de captura PNG del canvas WebGL para el servidor MCP. */
export const ViewportCaptureRegistrar: React.FC = () => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    registerViewportCapture(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL('image/png');
    });
    return () => registerViewportCapture(null);
  }, [gl, scene, camera]);

  return null;
};

/**
 * Controlador de presets de cámara y encuadre automático (tecla F).
 * Almacena objects/selectedIds/printerProfile en ref para que el useEffect
 * dependa únicamente de `cameraRequest` y jamás reajuste la cámara al seleccionar o editar.
 */

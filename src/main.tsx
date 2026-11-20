/**
 * @file src/main.tsx
 * @description Punto de entrada React 19 de Kura3D y carga de estilos de estudio CAD.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/studio.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

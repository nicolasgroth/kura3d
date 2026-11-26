/**
 * @file src/store/assistantsGallery.ts
 * @description Filtro y búsqueda de la galería de Asistentes. Viven fuera del componente para que al abrir un asistente
 * y volver a la galería sigan donde estaban; se reinician al cerrar el panel. Solo memoria (no es dato del proyecto).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { create } from 'zustand';
import type { GalleryFilter } from '../components/assistants/galleryModel';
import { useAssistantsPanel } from './assistantsPanel';

interface GalleryState {
  category: GalleryFilter;
  query: string;
}

const INITIAL: GalleryState = { category: 'all', query: '' };

export const useAssistantsGallery = create<GalleryState>(() => INITIAL);

export const setGalleryCategory = (category: GalleryFilter) => useAssistantsGallery.setState({ category });
export const setGalleryQuery = (query: string) => useAssistantsGallery.setState({ query });

useAssistantsPanel.subscribe((s, prev) => {
  if (prev.open && !s.open) useAssistantsGallery.setState(INITIAL);
});

/**
 * @file src/utils/projectNotesFocus.ts
 * @description Lleva al usuario a las notas del proyecto: muestra el panel «Proyecto» y enfoca el área de notas.
 * Lo usa la acción «Ver notas» del aviso que aparece al abrir un proyecto con notas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export const PROJECT_NOTES_ID = 'kura-project-notes';

/** Muestra el panel y enfoca las notas tras pintarlo (dos cuadros: el panel puede estar plegado o cambiar de contexto). */
export function revealProjectNotes(showProjectPanel: () => void): void {
  showProjectPanel();
  const focus = () => {
    const field = document.getElementById(PROJECT_NOTES_ID);
    field?.scrollIntoView?.({ block: 'nearest' });
    field?.focus({ preventScroll: true });
  };
  requestAnimationFrame(() => requestAnimationFrame(focus));
}

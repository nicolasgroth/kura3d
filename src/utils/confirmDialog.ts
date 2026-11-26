/**
 * @file src/utils/confirmDialog.ts
 * @description Servicio de decisiones accesibles que reemplaza a `confirm()`/`alert()` nativos: quien llama
 * pide una decisión con N acciones y recibe el `id` elegido (o `cancel` con Escape o al cerrar). El diálogo
 * lo dibuja `ConfirmDialogHost`, montado una vez en la aplicación.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';

export interface DecisionAction {
  id: string;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
}

export interface DecisionSpec {
  title: string;
  message: string;
  actions: DecisionAction[];
  /** Acción que recibe el foco inicial: la que no destruye nada. */
  safeId: string;
}

export interface DecisionRequest extends DecisionSpec {
  token: number;
  resolve: (id: string) => void;
}

interface DecisionState {
  request: DecisionRequest | null;
}

export const CANCEL_DECISION = 'cancel';

export const useDecisionStore = create<DecisionState>(() => ({ request: null }));

let nextToken = 1;

/** Pide una decisión al usuario. Una petición nueva cancela la que siga abierta. */
export function askDecision(spec: DecisionSpec): Promise<string> {
  settleDecision(CANCEL_DECISION);
  return new Promise<string>((resolve) => {
    useDecisionStore.setState({ request: { ...spec, token: nextToken++, resolve } });
  });
}

/** Cierra la petición vigente con la decisión indicada (no hace nada si no hay ninguna). */
export function settleDecision(id: string): void {
  const { request } = useDecisionStore.getState();
  if (!request) return;
  useDecisionStore.setState({ request: null });
  request.resolve(id);
}

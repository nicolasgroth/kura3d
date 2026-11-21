/**
 * @file src/ai/local/localAssistant.ts
 * @description Asistente local determinista (sin red ni clave). Ejecuta el plan de `localParser.ts`:
 * encadena acciones aplicando las posteriores al objeto recién creado, nunca modifica objetos que el
 * usuario no nombró (pide confirmación con "sí"), y responde en lenguaje natural con las dimensiones
 * reales leídas de la escena después de cada cambio.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t, type TranslationKey } from '../../i18n';
import type { KuraCommandRequest, LanguageCode, Vec3 } from '../../types/kura';
import type { AiTurnOutput, CommandExecutor } from '../providerLoop';
import { isAffirmative, isNegative, parseLocalPrompt, type LocalIntent, type LocalStep } from './localParser';

interface SceneObject {
  id: string;
  name: string;
  primitiveType?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  stats?: { dimensionsMm?: Vec3; volumeMm3?: number };
}

interface Scene {
  objects: SceneObject[];
  selectedIds: string[];
}

interface PendingAction {
  steps: LocalStep[];
  targetIds: string[];
}

/** Memoria de la conversación local: último objeto creado y acción pendiente de confirmar. */
const memory: { lastCreatedId: string | null; pending: PendingAction | null } = { lastCreatedId: null, pending: null };

/** Reinicia la memoria (pruebas). */
export function resetLocalAssistant(): void {
  memory.lastCreatedId = null;
  memory.pending = null;
}

const AXES = ['X', 'Y', 'Z'];
const MODIFIES: ReadonlySet<LocalIntent['kind']> = new Set([
  'move', 'scale', 'rotate', 'hollow', 'center', 'drop', 'duplicate', 'delete', 'texture', 'cut', 'boolean',
]);

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const dimsOf = (o?: SceneObject) => {
  const d = o?.stats?.dimensionsMm;
  return d ? `${fmt(d[0])} × ${fmt(d[1])} × ${fmt(d[2])} mm` : '—';
};

class LocalRun {
  readonly executedTools: AiTurnOutput['executedTools'] = [];
  readonly lines: string[] = [];
  scene: Scene = { objects: [], selectedIds: [] };
  createdId: string | null = null;
  private seq = 0;

  constructor(readonly lang: LanguageCode, private readonly execute: CommandExecutor) {}

  say(key: TranslationKey, params?: Record<string, string | number>) {
    this.lines.push(t(this.lang, key, params));
  }

  async run(command: KuraCommandRequest['command'], params: Record<string, unknown>, record = true) {
    const res = await this.execute({ id: `local_${Date.now()}_${this.seq++}`, command, params });
    if (record) {
      this.executedTools.push({ name: command, result: res.ok ? JSON.stringify(res.result ?? { ok: true }) : `Error: ${res.error}` });
    }
    return res;
  }

  async refresh(record = false) {
    const res = await this.run('get_scene_state', {}, record);
    const result = (res.ok ? res.result : null) as Partial<Scene> | null;
    this.scene = { objects: result?.objects ?? [], selectedIds: result?.selectedIds ?? [] };
  }

  find(id: string | null) {
    return id ? this.scene.objects.find((o) => o.id === id) : undefined;
  }

  output(): AiTurnOutput {
    return { assistantText: this.lines.join(' '), executedTools: this.executedTools, usedLocalFallback: true };
  }
}

type Resolution = { ids: string[] } | { confirm: string[] } | { ambiguous: string[] } | { none: true };

/** Decide sobre qué objetos actúa un paso, sin tocar nunca lo que el usuario no nombró. */
function resolveTarget(step: LocalStep, run: LocalRun): Resolution {
  const { ref } = step;
  const { objects, selectedIds } = run.scene;
  if (ref.selection) return selectedIds.length ? { ids: [...selectedIds] } : { none: true };
  if (ref.names.length) {
    const match = objects.filter((o) => o.name.toLowerCase() === ref.names[0].toLowerCase());
    if (match.length === 1) return { ids: [match[0].id] };
    if (match.length > 1) return { ambiguous: match.map((o) => o.name) };
  }
  if (ref.shape) {
    const created = run.find(run.createdId);
    if (created && created.primitiveType === ref.shape) return { ids: [created.id] };
    const sameType = objects.filter((o) => o.primitiveType === ref.shape);
    if (sameType.length === 1) return { ids: [sameType[0].id] };
    if (sameType.length > 1) return { ambiguous: sameType.map((o) => o.name) };
  }
  if (run.createdId && run.find(run.createdId)) return { ids: [run.createdId] };
  if (ref.pronoun && run.find(memory.lastCreatedId)) return { ids: [memory.lastCreatedId!] };
  if (step.intent.kind === 'boolean' && selectedIds.length >= 2) return { confirm: [...selectedIds] };
  if (selectedIds.length) return { confirm: [...selectedIds] };
  return { none: true };
}

const names = (run: LocalRun, ids: string[]) =>
  ids.map((id) => `«${run.find(id)?.name ?? id}»`).join(', ');

/** Ejecuta un paso sobre objetivos ya resueltos. Devuelve false si falló (se detiene el plan). */
async function applyStep(intent: LocalIntent, ids: string[], run: LocalRun): Promise<boolean> {
  const fail = (error?: string) => {
    run.say('ai.local.failed', { action: intent.kind, error: error ?? '—' });
    return false;
  };
  switch (intent.kind) {
    case 'create': {
      const res = await run.run('create_primitive', { type: intent.shape, ...intent.params, ...(intent.color ? { color: intent.color } : {}) });
      if (!res.ok) return fail(res.error);
      const id = (res.result as { id?: string } | null)?.id ?? null;
      run.createdId = id;
      memory.lastCreatedId = id;
      await run.refresh();
      const obj = run.find(id);
      run.say('ai.local.created', { name: obj?.name ?? intent.shape, dims: dimsOf(obj) });
      return true;
    }
    case 'boolean': {
      const res = await run.run('boolean_operation', { op: intent.op });
      if (!res.ok) return fail(res.error);
      const id = (res.result as { id?: string } | null)?.id ?? null;
      run.createdId = id;
      await run.refresh();
      const obj = run.find(id);
      run.say('ai.local.booleanDone', { op: t(run.lang, `ai.local.op.${intent.op}` as TranslationKey), name: obj?.name ?? '—', dims: dimsOf(obj) });
      return true;
    }
    case 'export': {
      const res = await run.run(intent.format === '3mf' ? 'export_3mf' : 'export_stl', { onlySelected: intent.onlySelected });
      if (!res.ok) return fail(res.error);
      run.say('ai.local.exported', { format: intent.format.toUpperCase() });
      return true;
    }
    case 'delete': {
      const label = names(run, ids);
      const res = await run.run('delete_object', ids.length === 1 ? { id: ids[0] } : { ids });
      if (!res.ok) return fail(res.error);
      if (ids.includes(run.createdId ?? '')) run.createdId = null;
      await run.refresh();
      run.say('ai.local.deleted', { names: label });
      return true;
    }
    default:
      break;
  }
  for (const id of ids) {
    const obj = run.find(id);
    if (!obj) return fail();
    const name = obj.name;
    let res;
    switch (intent.kind) {
      case 'move': {
        const position: Vec3 = [...obj.position];
        position[intent.axis] += intent.amount;
        res = await run.run('transform_object', { id, position });
        break;
      }
      case 'scale':
        res = await run.run('transform_object', { id, scale: obj.scale.map((s) => s * intent.factor) });
        break;
      case 'rotate': {
        const rotation: Vec3 = [...obj.rotation];
        rotation[intent.axis] += (intent.degrees * Math.PI) / 180;
        res = await run.run('transform_object', { id, rotation });
        break;
      }
      case 'hollow':
        res = await run.run('hollow_object', { id, wallThickness: intent.wall, drainHole: intent.drain });
        break;
      case 'center':
        res = await run.run('transform_object', { id, centerOnBed: true });
        break;
      case 'drop':
        res = await run.run('transform_object', { id, dropToBed: true });
        break;
      case 'duplicate':
        res = await run.run('duplicate_object', { id });
        break;
      case 'texture':
        res = await run.run('apply_texture', { id, pattern: intent.pattern, depth: 0.45, scale: 4 });
        break;
      case 'cut':
        res = await run.run('plane_cut', { id, axis: 'y', offset: 0, connectorType: 'dowel', connectorCount: 2 });
        break;
      default:
        return fail();
    }
    if (!res.ok) return fail(res.error);
    await run.refresh();
    const after = run.find(id);
    switch (intent.kind) {
      case 'move':
        run.say('ai.local.moved', {
          name, amount: fmt(intent.amount), axis: AXES[intent.axis],
          position: after ? after.position.map(fmt).join(', ') : '—',
        });
        break;
      case 'scale':
        run.say('ai.local.scaled', { name, percent: fmt(intent.factor * 100), dims: dimsOf(after) });
        break;
      case 'rotate':
        run.say('ai.local.rotated', { name, degrees: fmt(intent.degrees), axis: AXES[intent.axis] });
        break;
      case 'hollow':
        run.say(intent.drain ? 'ai.local.hollowedDrain' : 'ai.local.hollowed', { name, wall: fmt(intent.wall), dims: dimsOf(after) });
        break;
      case 'center':
        run.say('ai.local.centered', { name });
        break;
      case 'drop':
        run.say('ai.local.dropped', { name });
        break;
      case 'duplicate': {
        const copy = (res.result as Array<{ id: string; name: string }> | null)?.[0];
        if (copy) run.createdId = copy.id;
        run.say('ai.local.duplicated', { name, copy: copy?.name ?? '—' });
        break;
      }
      case 'texture':
        run.say('ai.local.textured', { name, pattern: intent.pattern });
        break;
      case 'cut': {
        const parts = (res.result as unknown[] | null)?.length ?? 0;
        run.say('ai.local.cut', { name, count: parts });
        break;
      }
    }
  }
  return true;
}

function describeScene(run: LocalRun, step: LocalStep) {
  const { objects, selectedIds } = run.scene;
  if (objects.length === 0) {
    run.say('ai.local.sceneEmpty');
    return;
  }
  let targets: SceneObject[] = [];
  if (step.intent.kind === 'query' && step.intent.what === 'size') {
    const r = resolveTarget(step, run);
    const ids = 'ids' in r ? r.ids : 'confirm' in r ? r.confirm : objects.length === 1 ? [objects[0].id] : [];
    targets = ids.map((id) => run.find(id)).filter((o): o is SceneObject => Boolean(o));
    if (!targets.length && 'ambiguous' in r) {
      targets = objects.filter((o) => r.ambiguous.includes(o.name));
    }
  }
  if (targets.length === 0) {
    const list = objects.slice(0, 8).map((o) => `${o.name} (${dimsOf(o)})`).join('; ');
    const extra = objects.length > 8 ? ` …(+${objects.length - 8})` : '';
    run.say('ai.local.sceneList', { count: objects.length, list: list + extra, selected: selectedIds.length });
    return;
  }
  for (const o of targets.slice(0, 8)) {
    const volume = o.stats?.volumeMm3;
    run.say('ai.local.objectSize', { name: o.name, dims: dimsOf(o), volume: volume ? fmt(volume / 1000) : '—' });
  }
}

/** Punto de entrada: interpreta y ejecuta una orden del chat sin conexión. */
export async function runLocalAssistant(prompt: string, lang: LanguageCode, execute: CommandExecutor): Promise<AiTurnOutput> {
  const run = new LocalRun(lang, execute);
  const pending = memory.pending;
  memory.pending = null;

  if (pending && isAffirmative(prompt)) {
    await run.refresh();
    const ids = pending.targetIds.filter((id) => run.find(id));
    if (!ids.length) {
      run.say('ai.local.noTarget', { action: pending.steps[0].clause });
      return run.output();
    }
    for (const step of pending.steps) {
      if (!(await applyStep(step.intent, step.intent.kind === 'boolean' ? [] : ids, run))) break;
    }
    return run.output();
  }
  if (pending && isNegative(prompt)) {
    run.say('ai.local.cancelled');
    return run.output();
  }

  await run.refresh();
  const plan = parseLocalPrompt(prompt, run.scene.objects.map((o) => o.name));
  if (plan.outOfRange.length) {
    run.say('ai.local.outOfRange', { value: fmt(plan.outOfRange[0]) });
    return run.output();
  }
  if (plan.steps.length === 0) {
    run.say('ai.local.notUnderstood', { text: prompt.trim().slice(0, 80) });
    return run.output();
  }

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const { intent } = step;
    if (intent.kind === 'query') {
      await run.refresh(true);
      describeScene(run, step);
      continue;
    }
    if (intent.kind === 'create' || intent.kind === 'export') {
      if (!(await applyStep(intent, [], run))) break;
      continue;
    }
    if (!MODIFIES.has(intent.kind)) continue;
    const target = resolveTarget(step, run);
    if ('ambiguous' in target) {
      run.say('ai.local.ambiguous', { names: target.ambiguous.map((n) => `«${n}»`).join(', ') });
      break;
    }
    if ('none' in target) {
      run.say(step.ref.selection ? 'ai.local.noSelection' : 'ai.local.noTarget', { action: step.clause });
      break;
    }
    if ('confirm' in target) {
      // No se nombró ningún objeto: se pregunta antes de tocar la selección actual.
      const rest = plan.steps.slice(i).filter((s) => MODIFIES.has(s.intent.kind));
      memory.pending = { steps: rest, targetIds: target.confirm };
      run.say('ai.local.confirm', { action: rest.map((s) => s.clause).join(' + '), names: names(run, target.confirm) });
      break;
    }
    if (!(await applyStep(intent, intent.kind === 'boolean' ? [] : target.ids, run))) break;
  }
  if (plan.unknown.length) run.say('ai.local.partlyUnderstood', { text: plan.unknown.join(' / ').slice(0, 80) });
  return run.output();
}

/**
 * @file src/store/__tests__/projectInfoStore.test.ts
 * @description Datos del proyecto en el store: `createdAt` se fija al crear el proyecto y abrir no lo cambia ni lo
 * inventa; `modifiedAt` cambia al guardar y no al abrir; editar marca el proyecto como modificado sin entrar al
 * historial de deshacer; el tiempo de trabajo viaja en el archivo pero no marca cambios; el aviso de notas al abrir
 * y los comandos `get_project_info` / `set_project_info` del bus (con entradas hostiles).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMAND_ACCESS } from '../../core/commands/commandPolicy';
import { decodeProject, encodeProject } from '../../project/projectCodec';
import { openProjectFile, saveProjectFile } from '../../project/projectFiles';
import { PROJECT_INFO_LIMITS } from '../../project/projectInfo';
import type { KuraCommandRequest } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { isProjectDirty, useKuraStore } from '../useKuraStore';

vi.mock('../../project/projectFiles', async (importActual) => ({
  ...(await importActual<typeof import('../../project/projectFiles')>()),
  openProjectFile: vi.fn(),
  saveProjectFile: vi.fn(),
}));

const get = useKuraStore.getState;
let baseline: ReturnType<typeof get>;

async function savedBytes() {
  const data = vi.mocked(saveProjectFile).mock.lastCall![1];
  return typeof data === 'function' ? await data() : data;
}

const run = async (command: string, params: Record<string, unknown> = {}) =>
  (await get().executeCommand({ id: 'i', command: command as KuraCommandRequest['command'], params }, 'mcp')) as CommandBusResponse;

describe('datos del proyecto en el store', () => {
  beforeAll(async () => {
    await get().initEngine();
    baseline = get();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    useKuraStore.setState({ ...baseline, projectInfo: { createdAt: '2026-11-20T10:00:00Z' }, projectWorkSeconds: 0, toasts: [] }, true);
    useKuraStore.setState({ savedProject: { ...baseline.savedProject!, info: { createdAt: '2026-11-20T10:00:00Z' } } });
  });

  afterEach(() => vi.useRealTimers());

  it('el proyecto de arranque trae fecha de creación y ningún dato más', () => {
    expect(baseline.projectInfo.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(baseline.projectInfo.modifiedAt).toBeUndefined();
    expect(baseline.projectInfo.description).toBeUndefined();
  });

  it('editar limpia el texto, marca cambios y no es un paso de deshacer', () => {
    expect(isProjectDirty(get())).toBe(false);
    const past = get().past;
    expect(get().setProjectInfo({ description: ' Soporte\u0000\n de pared ', notes: 'a\r\nb\u0007', author: 'Ana' })).toBe(true);
    expect(get().projectInfo).toMatchObject({ description: ' Soporte  de pared ', notes: 'a\nb', author: 'Ana' });
    expect(isProjectDirty(get())).toBe(true);
    expect(get().past).toBe(past);
    // Mismo valor: nada cambia.
    expect(get().setProjectInfo({ author: 'Ana' })).toBe(false);
    // Vaciar borra el campo y vuelve a limpio.
    get().setProjectInfo({ description: '', notes: '', author: '' });
    expect(get().projectInfo).toEqual({ createdAt: '2026-11-20T10:00:00Z' });
    expect(isProjectDirty(get())).toBe(false);
  });

  it('recorta a los topes y no edita mientras se guarda', () => {
    get().setProjectInfo({ description: 'x'.repeat(2000), notes: 'n'.repeat(50_000), author: 'a'.repeat(500) });
    expect(get().projectInfo.description).toHaveLength(PROJECT_INFO_LIMITS.description);
    expect(get().projectInfo.notes).toHaveLength(PROJECT_INFO_LIMITS.notes);
    expect(get().projectInfo.author).toHaveLength(PROJECT_INFO_LIMITS.author);
    useKuraStore.setState({ projectBusy: true });
    expect(get().setProjectInfo({ author: 'otro' })).toBe(false);
  });

  it('guardar fija modifiedAt, conserva createdAt y deja el proyecto limpio; abrir no cambia fechas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T14:05:09Z'));
    get().setProjectInfo({ description: 'Caja', notes: 'Pendiente: tapa', author: 'Ana' });
    get().addProjectWorkSeconds(8100);
    vi.mocked(saveProjectFile).mockResolvedValue({ name: 'Caja.kura', location: 'loc' });
    expect(await get().saveProject()).toBe(true);
    expect(get().projectInfo.modifiedAt).toBe('2026-11-23T14:05:09Z');
    expect(isProjectDirty(get())).toBe(false);
    const bytes = await savedBytes();
    expect(decodeProject(bytes).info).toEqual({
      description: 'Caja', notes: 'Pendiente: tapa', author: 'Ana',
      createdAt: '2026-11-20T10:00:00Z', modifiedAt: '2026-11-23T14:05:09Z', workSeconds: 8100,
    });

    // Un día después, abrir el archivo no toca las fechas ni el tiempo; tampoco marca cambios.
    vi.setSystemTime(new Date('2026-11-24T09:00:00Z'));
    vi.mocked(openProjectFile).mockResolvedValue({ name: 'Caja.kura', location: 'loc', bytes });
    expect(await get().openProject()).toBe(true);
    expect(get().projectInfo).toEqual({
      description: 'Caja', notes: 'Pendiente: tapa', author: 'Ana', createdAt: '2026-11-20T10:00:00Z', modifiedAt: '2026-11-23T14:05:09Z',
    });
    expect(get().projectWorkSeconds).toBe(8100);
    expect(isProjectDirty(get())).toBe(false);

    // Guardar de nuevo sí actualiza modifiedAt.
    await get().saveProject();
    expect(get().projectInfo.modifiedAt).toBe('2026-11-24T09:00:00Z');
    expect(get().projectInfo.createdAt).toBe('2026-11-20T10:00:00Z');
  });

  it('un proyecto sin fecha abre sin inventarla y el reloj de trabajo no marca cambios', async () => {
    const bytes = encodeProject({ ...get().savedProject!, info: undefined, objects: [], selectedIds: [], past: [], future: [] });
    vi.mocked(openProjectFile).mockResolvedValue({ name: 'Viejo.kura', bytes });
    expect(await get().openProject()).toBe(true);
    expect(get().projectInfo).toEqual({});
    expect(get().projectWorkSeconds).toBe(0);
    expect(isProjectDirty(get())).toBe(false);
    get().addProjectWorkSeconds(600);
    get().addProjectWorkSeconds(Number.NaN);
    get().addProjectWorkSeconds(-5);
    expect(get().projectWorkSeconds).toBe(600);
    expect(isProjectDirty(get())).toBe(false);

    vi.mocked(saveProjectFile).mockResolvedValue({ name: 'Viejo.kura' });
    await get().saveProject();
    const info = decodeProject(await savedBytes()).info!;
    expect(info.createdAt).toBeUndefined();
    expect(info.modifiedAt).toBeDefined();
    expect(info.workSeconds).toBe(600);
  });

  it('un proyecto nuevo nace con su propia fecha de creación y sin los datos anteriores', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-01T08:30:00Z'));
    get().setProjectInfo({ description: 'viejo', notes: 'notas viejas' });
    get().addProjectWorkSeconds(300);
    expect(get().newProject()).toBe(true);
    expect(get().projectInfo).toEqual({ createdAt: '2026-12-01T08:30:00Z' });
    expect(get().projectWorkSeconds).toBe(0);
  });

  it('avisa que hay notas al abrir (con «Ver notas») y calla si no las hay', async () => {
    get().setProjectInfo({ notes: 'Imprimir en PETG' });
    vi.mocked(saveProjectFile).mockResolvedValue({ name: 'N.kura' });
    await get().saveProject();
    const bytes = await savedBytes();
    useKuraStore.setState({ toasts: [] });
    vi.mocked(openProjectFile).mockResolvedValue({ name: 'N.kura', bytes });
    await get().openProject();
    const notice = get().toasts.find((toast) => toast.text === 'Este proyecto tiene notas.');
    expect(notice).toBeDefined();
    expect(notice!.action?.label).toBe('Ver notas');

    get().setProjectInfo({ notes: '' });
    await get().saveProject();
    const plain = await savedBytes();
    useKuraStore.setState({ toasts: [] });
    vi.mocked(openProjectFile).mockResolvedValue({ name: 'S.kura', bytes: plain });
    await get().openProject();
    expect(get().toasts.some((toast) => toast.text === 'Este proyecto tiene notas.')).toBe(false);
  });
});

describe('comandos get_project_info / set_project_info', () => {
  beforeAll(async () => { await get().initEngine(); });
  beforeEach(() => {
    useKuraStore.setState({ projectName: 'Caja.kura', projectInfo: { createdAt: '2026-11-20T10:00:00Z' }, projectWorkSeconds: 61.7, projectBusy: false, language: 'en', toasts: [] });
  });

  it('leer es de lectura; escribir es de escritura', () => {
    expect(COMMAND_ACCESS.get_project_info).toBe('read');
    expect(COMMAND_ACCESS.set_project_info).toBe('write');
  });

  it('get devuelve campos vacíos o nulos, no inventa', async () => {
    const res = await run('get_project_info');
    expect(res.ok).toBe(true);
    expect(res.result).toEqual({
      name: 'Caja.kura', description: '', notes: '', author: '', createdAt: '2026-11-20T10:00:00Z', modifiedAt: null, workSeconds: 61,
    });
  });

  it('set escribe, marca cambios y responde con el estado; vaciar borra', async () => {
    const res = await run('set_project_info', { description: 'Soporte', notes: 'l1\nl2', author: 'Ana' });
    expect(res.ok).toBe(true);
    expect(res.result).toMatchObject({ description: 'Soporte', notes: 'l1\nl2', author: 'Ana', changed: true });
    expect(isProjectDirty(get())).toBe(true);
    expect((await run('set_project_info', { author: 'Ana' })).result).toMatchObject({ changed: false });
    expect((await run('set_project_info', { description: '' })).result).toMatchObject({ description: '' });
  });

  it('set rechaza entradas hostiles con invalid-params y no cambia nada', async () => {
    const before = get().projectInfo;
    const hostile: Array<Record<string, unknown>> = [
      {}, { nombre: 'x' }, { fecha: '2026-01-01' }, { createdAt: '2026-01-01T00:00:00Z' }, { workSeconds: 5 },
      { description: 5 }, { notes: ['a'] }, { author: null }, { description: 'a\nb' }, { notes: 'a\u0000b' },
      { description: 'x'.repeat(PROJECT_INFO_LIMITS.description + 1) }, { notes: 'x'.repeat(PROJECT_INFO_LIMITS.notes + 1) },
      { author: 'a\u202eb' },
    ];
    for (const params of hostile) {
      const res = await run('set_project_info', params);
      expect(res.ok, JSON.stringify(params).slice(0, 60)).toBe(false);
      expect(res.errorCode).toBe('invalid-params');
    }
    expect(get().projectInfo).toBe(before);
  });

  it('set responde ocupado mientras se guarda', async () => {
    useKuraStore.setState({ projectBusy: true });
    const res = await run('set_project_info', { author: 'Ana' });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('busy');
  });

  it('el HTML se guarda como texto', async () => {
    await run('set_project_info', { notes: '<img src=x onerror=alert(1)>' });
    expect(get().projectInfo.notes).toBe('<img src=x onerror=alert(1)>');
  });
});

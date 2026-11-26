/**
 * @file src/engine/__tests__/modelImportSession.test.ts
 * @description Sesión de importación en Worker: el archivo (Blob) se lee dentro del Worker, el buffer
 * se transfiere sin copiar, los MTL viajan una sola vez por Worker y se decodifican allá, y si el Worker
 * muere o se pasa de tiempo el error es "no hay memoria suficiente" y el siguiente archivo usa un Worker nuevo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelImportError, attachFileName } from '../io/importErrors';
import { createModelImportSession } from '../io/modelImportSession';
import { MtlLibrary, runModelImport, type ModelImportWorkerMessage } from '../io/modelImportTask';
import { MODEL_IO_LIMITS } from '../operationLimits';

const enc = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const OBJ = 'mtllib colores.mtl\no Pieza\nv 0 0 0\nv 3 0 0\nv 0 3 0\nv 0 0 3\nusemtl rojo\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4\n';
const MTL = 'newmtl rojo\nKd 1 0 0\n';

type Behaviour = 'run' | 'crash' | 'silent';

/** Worker simulado: ejecuta la tarea real en proceso, o se cae, o nunca responde. */
function fakeWorkerFactory(plan: Behaviour[]) {
  const created: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: { message: string; preventDefault: () => void }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    readonly messages: ModelImportWorkerMessage[] = [];
    readonly transfers: Transferable[][] = [];
    readonly terminate = vi.fn();
    private readonly library = new MtlLibrary();
    constructor(readonly behaviour: Behaviour) {}
    postMessage(message: ModelImportWorkerMessage, transfer: Transferable[] = []) {
      this.messages.push(message);
      this.transfers.push(transfer);
      if (message.kind === 'mtl') {
        this.library.set(message.entries);
        return;
      }
      if (this.behaviour === 'silent') return;
      if (this.behaviour === 'crash') {
        queueMicrotask(() => this.onerror?.({ message: 'Out of memory', preventDefault: () => {} }));
        return;
      }
      void runModelImport(this.library, message).then(
        (model) => this.onmessage?.({ data: { id: message.id, ok: true, model } }),
        (error: ModelImportError) => this.onmessage?.({ data: { id: message.id, ok: false, code: error.code, message: error.message } }),
      );
    }
  }
  let next = 0;
  const createWorker = () => {
    const worker = new FakeWorker(plan[Math.min(next++, plan.length - 1)]);
    created.push(worker);
    return worker as unknown as Worker;
  };
  return { created, createWorker };
}

afterEach(() => vi.unstubAllGlobals());

describe('sesión de importación en Worker', () => {
  it('pasa el Blob al Worker sin leerlo en el hilo principal', async () => {
    const { created, createWorker } = fakeWorkerFactory(['run']);
    const session = createModelImportSession([], { createWorker });
    const blob = new Blob([OBJ]);
    const spy = vi.spyOn(blob, 'arrayBuffer');
    const model = await session.parse('pieza.obj', blob);
    session.dispose();
    expect(model.parts).toHaveLength(1);
    const parse = created[0].messages.find((m) => m.kind === 'parse');
    expect(parse && parse.kind === 'parse' && parse.source).toBe(blob);
    // El fake lee el Blob "dentro del Worker": una sola lectura, ninguna en el llamador antes de enviar.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(created[0].terminate).toHaveBeenCalled();
  });

  it('transfiere el ArrayBuffer en vez de clonarlo', async () => {
    const { created, createWorker } = fakeWorkerFactory(['run']);
    const session = createModelImportSession([], { createWorker });
    const buffer = enc(OBJ);
    await session.parse('pieza.obj', buffer);
    session.dispose();
    expect(created[0].transfers.find((t) => t.length > 0)).toEqual([buffer]);
  });

  it('envía los MTL una sola vez por Worker y el OBJ toma su color (decodificado en el Worker)', async () => {
    const { created, createWorker } = fakeWorkerFactory(['run']);
    const session = createModelImportSession([{ name: 'colores.mtl', data: new Blob([MTL]) }], { createWorker });
    const a = await session.parse('a.obj', enc(OBJ));
    const b = await session.parse('b.obj', enc(OBJ));
    session.dispose();
    expect(created).toHaveLength(1);
    expect(created[0].messages.filter((m) => m.kind === 'mtl')).toHaveLength(1);
    expect(a.parts[0].color).toBe('#ff0000');
    expect(b.parts[0].color).toBe('#ff0000');
  });

  it('si el Worker se cae: error de memoria, se termina y el siguiente archivo usa un Worker nuevo', async () => {
    const { created, createWorker } = fakeWorkerFactory(['crash', 'run']);
    const session = createModelImportSession([{ name: 'colores.mtl', data: enc(MTL) }], { createWorker });
    const failed = session.parse('enorme.obj', enc(OBJ));
    await expect(failed).rejects.toBeInstanceOf(ModelImportError);
    await expect(failed).rejects.toMatchObject({ code: 'out-of-memory', fileName: 'enorme.obj' });
    expect(created[0].terminate).toHaveBeenCalled();
    const ok = await session.parse('pieza.obj', enc(OBJ));
    session.dispose();
    expect(created).toHaveLength(2);
    // El Worker nuevo vuelve a recibir los MTL (una vez) y el OBJ sale con su color.
    expect(created[1].messages.filter((m) => m.kind === 'mtl')).toHaveLength(1);
    expect(ok.parts[0].color).toBe('#ff0000');
  });

  it('si el Worker no responde a tiempo: error de memoria, se termina y se recrea', async () => {
    const { created, createWorker } = fakeWorkerFactory(['silent', 'run']);
    const session = createModelImportSession([], { createWorker, timeoutMs: 20 });
    await expect(session.parse('lento.obj', enc(OBJ))).rejects.toMatchObject({ code: 'out-of-memory', fileName: 'lento.obj' });
    expect(created[0].terminate).toHaveBeenCalled();
    await expect(session.parse('pieza.obj', enc(OBJ))).resolves.toBeTruthy();
    session.dispose();
  });

  it('sin Worker (Node) lee en proceso, también un Blob con su MTL', async () => {
    const session = createModelImportSession([{ name: 'colores.mtl', data: new Blob([MTL]) }], { createWorker: () => null });
    const model = await session.parse('pieza.obj', new Blob([OBJ]));
    session.dispose();
    expect(model.parts[0].color).toBe('#ff0000');
  });

  it('rechaza un Blob sobre el máximo sin leerlo', async () => {
    const session = createModelImportSession([], { createWorker: () => null });
    const blob = new Blob(['x']);
    Object.defineProperty(blob, 'size', { value: MODEL_IO_LIMITS.maxFileBytes + 1 });
    const spy = vi.spyOn(blob, 'arrayBuffer');
    await expect(session.parse('gigante.stl', blob)).rejects.toMatchObject({ code: 'too-large' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('MTL en el Worker', () => {
  it('ignora un MTL sobre su tope propio de 8 MiB', async () => {
    const library = new MtlLibrary();
    const big = new Blob([MTL]);
    Object.defineProperty(big, 'size', { value: MODEL_IO_LIMITS.maxMtlBytes + 1 });
    library.set([{ name: 'colores.mtl', data: big }]);
    expect(await library.textFor(enc(OBJ))).toBeUndefined();
  });

  it('elige por mtllib y, si hay uno solo, ese', async () => {
    const library = new MtlLibrary();
    library.set([{ name: 'otro.mtl', data: enc('newmtl a\nKd 0 1 0\n') }, { name: 'Colores.MTL', data: enc(MTL) }]);
    expect(await library.textFor(enc(OBJ))).toBe(MTL);
    const single = new MtlLibrary();
    single.set([{ name: 'x.mtl', data: enc(MTL) }]);
    expect(await single.textFor(enc('v 0 0 0\n'))).toBe(MTL);
  });
});

describe('fallos de memoria', () => {
  it('un RangeError de reserva se informa como falta de memoria', () => {
    expect(attachFileName(new RangeError('Array buffer allocation failed'), 'x.stl').code).toBe('out-of-memory');
    expect(attachFileName(new RangeError('Invalid typed array length: 99999999999'), 'x.stl').code).toBe('out-of-memory');
  });
});

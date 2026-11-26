/**
 * @file src/engine/__tests__/slicerProjectSample.test.ts
 * @description Proyecto de ejemplo del laminador: de un .3mf guardado por Bambu Studio / OrcaSlicer / Elegoo Slicer se
 * toman SOLO seis identificadores de perfil (lista blanca); datos de conexión, claves de API y parámetros de laminado
 * nunca salen. Rechaza tipos, largos y caracteres de control inválidos; el `project_settings.config` que escribe la
 * exportación lleva exactamente 9 claves con los colores de la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  extractSlicerProjectSample,
  parseSlicerProjectSample,
  slicerProjectSettingsJson,
  MAX_SAMPLE_FILAMENTS,
} from '../io/slicerProjectSample';

const PROFILE = {
  version: '1.5.3.5',
  name: 'project_settings',
  from: 'project',
  printer_settings_id: 'Elegoo Centauri Carbon 2 0.2 nozzle',
  print_settings_id: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
  filament_settings_id: ['Elegoo PLA+ @ECC2', 'Elegoo PLA Silk @ECC2'],
  printer_model: 'Elegoo Centauri Carbon 2',
  default_print_profile: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
  filament_colour: ['#FFFFFF', '#0000FF'],
  // Lo que NUNCA debe salir: conexión, credenciales y parámetros de laminado.
  print_host: '192.168.1.50',
  printhost_apikey: 'SECRETO-123',
  printhost_password: 'clave',
  host_type: 'octoprint',
  layer_height: '0.1',
  nozzle_temperature: ['220'],
};

const pack = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
const withSettings = (json: unknown) => pack({ '3D/3dmodel.model': '<model/>', 'Metadata/project_settings.config': JSON.stringify(json) });

describe('extraer el proyecto de ejemplo', () => {
  it('toma solo la lista blanca', () => {
    const res = extractSlicerProjectSample(withSettings(PROFILE));
    expect(res).toEqual({
      ok: true,
      sample: {
        version: '1.5.3.5',
        printerSettingsId: 'Elegoo Centauri Carbon 2 0.2 nozzle',
        printSettingsId: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
        filamentSettingsIds: ['Elegoo PLA+ @ECC2', 'Elegoo PLA Silk @ECC2'],
        printerModel: 'Elegoo Centauri Carbon 2',
        defaultPrintProfile: '0.10mm Standard @Elegoo CC2 0.2 nozzle',
      },
    });
    const text = JSON.stringify(res);
    for (const leak of ['192.168', 'SECRETO', 'clave', 'octoprint', 'layer_height', 'nozzle_temperature', 'print_host']) expect(text).not.toContain(leak);
  });

  it('ni el JSON exportado deja pasar claves ajenas', () => {
    const res = extractSlicerProjectSample(withSettings(PROFILE));
    if (!res.ok) throw new Error('debía leerse');
    const json = JSON.parse(slicerProjectSettingsJson(res.sample, ['#e53935']));
    expect(Object.keys(json)).toEqual([
      'version', 'name', 'from', 'printer_settings_id', 'print_settings_id', 'filament_settings_id', 'printer_model', 'default_print_profile', 'filament_colour',
    ]);
    expect(JSON.stringify(json)).not.toMatch(/SECRETO|192\.168|octoprint/);
  });

  it.each([
    ['no es ZIP', strToU8('hola'), 'not-3mf'],
    ['sin perfil', pack({ '3D/3dmodel.model': '<model/>' }), 'no-profile'],
    ['JSON roto', pack({ 'Metadata/project_settings.config': '{roto' }), 'unreadable'],
    ['falta una clave', withSettings({ ...PROFILE, printer_model: undefined }), 'no-profile'],
    ['número en vez de texto', withSettings({ ...PROFILE, version: 15 }), 'no-profile'],
    ['texto de más de 200', withSettings({ ...PROFILE, printer_model: 'x'.repeat(201) }), 'no-profile'],
    ['carácter de control', withSettings({ ...PROFILE, print_settings_id: 'a\u0007b' }), 'no-profile'],
    ['salto de línea', withSettings({ ...PROFILE, printer_settings_id: 'a\nb' }), 'no-profile'],
    ['filamentos vacíos', withSettings({ ...PROFILE, filament_settings_id: [] }), 'no-profile'],
    ['demasiados filamentos', withSettings({ ...PROFILE, filament_settings_id: Array(MAX_SAMPLE_FILAMENTS + 1).fill('PLA') }), 'no-profile'],
    ['filamento no texto', withSettings({ ...PROFILE, filament_settings_id: ['PLA', 3] }), 'no-profile'],
    ['raíz que no es objeto', withSettings(['a']), 'no-profile'],
  ])('rechaza: %s', (_label, bytes, reason) => {
    expect(extractSlicerProjectSample(bytes)).toEqual({ ok: false, reason });
  });

  it('acepta la ruta con otra capitalización', () => {
    const res = extractSlicerProjectSample(pack({ 'metadata/Project_Settings.config': JSON.stringify(PROFILE) }));
    expect(res.ok).toBe(true);
  });

  it('un perfil gigante no se descomprime entero', () => {
    const big = JSON.stringify({ ...PROFILE, relleno: 'x'.repeat(5 << 20) });
    expect(extractSlicerProjectSample(pack({ 'Metadata/project_settings.config': big }))).toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('validar lo guardado', () => {
  const sample = {
    version: '1', printerSettingsId: 'P', printSettingsId: 'Q', filamentSettingsIds: ['F'], printerModel: 'M', defaultPrintProfile: 'D',
  };
  it('acepta lo válido y descarta claves extra', () => {
    expect(parseSlicerProjectSample({ ...sample, printHost: 'x' })).toEqual(sample);
  });
  it('rechaza basura', () => {
    expect(parseSlicerProjectSample(null)).toBeNull();
    expect(parseSlicerProjectSample('texto')).toBeNull();
    expect(parseSlicerProjectSample({ ...sample, printerModel: '' })).toBeNull();
    expect(parseSlicerProjectSample({ ...sample, filamentSettingsIds: 'F' })).toBeNull();
  });
});

describe('project_settings.config de la exportación', () => {
  const sample = {
    version: '1.5.3.5', printerSettingsId: 'P', printSettingsId: 'Q', filamentSettingsIds: ['F1', 'F2'], printerModel: 'M', defaultPrintProfile: 'D',
  };
  it('colores de la escena en mayúsculas y filamentos ajustados: repite el primero si faltan', () => {
    const json = JSON.parse(slicerProjectSettingsJson(sample, ['#e53935', '#1e88e5', '#43a047']));
    expect(json).toEqual({
      version: '1.5.3.5', name: 'project_settings', from: 'project', printer_settings_id: 'P', print_settings_id: 'Q',
      filament_settings_id: ['F1', 'F2', 'F1'], printer_model: 'M', default_print_profile: 'D', filament_colour: ['#E53935', '#1E88E5', '#43A047'],
    });
  });
  it('recorta si sobran filamentos', () => {
    const json = JSON.parse(slicerProjectSettingsJson(sample, ['#ffffff']));
    expect(json.filament_settings_id).toEqual(['F1']);
    expect(json.filament_colour).toEqual(['#FFFFFF']);
  });
});

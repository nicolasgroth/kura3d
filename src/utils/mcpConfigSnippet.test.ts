/**
 * @file src/utils/mcpConfigSnippet.test.ts
 * @description Pruebas del JSON MCP copiable: ruta absoluta o marcador, variables de entorno y comando de registro.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  buildClaudeAddCommand,
  buildMcpSnippet,
  mcpServerPath,
  MCP_REPO_PLACEHOLDER,
  normalizeRepoPath,
} from './mcpConfigSnippet';

const config = { port: 17432, authToken: 'token-de-prueba-123456', readOnly: false };

describe('JSON de configuración MCP', () => {
  it('sin ruta conocida usa el marcador y nunca la ruta relativa', () => {
    const json = JSON.parse(buildMcpSnippet(config, ''));
    expect(json.mcpServers.kura3d.args[0]).toBe(`${MCP_REPO_PLACEHOLDER}/mcp-server/dist/index.js`);
    expect(buildMcpSnippet(config, '')).not.toContain('"mcp-server/dist/index.js"');
  });

  it('con ruta absoluta respeta el separador de Windows y de POSIX', () => {
    expect(mcpServerPath('C:\\proyectos\\kura3d\\')).toBe('C:\\proyectos\\kura3d\\mcp-server\\dist\\index.js');
    expect(mcpServerPath('/home/ana/kura3d')).toBe('/home/ana/kura3d/mcp-server/dist/index.js');
  });

  it('limpia comillas y saltos de línea de la ruta escrita', () => {
    expect(normalizeRepoPath(' "/opt/kura3d"\n')).toBe('/opt/kura3d');
  });

  it('incluye puerto, token y solo lectura en el entorno', () => {
    const env = JSON.parse(buildMcpSnippet({ ...config, readOnly: true }, '/x')).mcpServers.kura3d.env;
    expect(env).toEqual({
      KURA_BRIDGE_PORT: '17432',
      KURA_BRIDGE_TOKEN: config.authToken,
      KURA_BRIDGE_READ_ONLY: 'true',
    });
  });

  it('permite mostrar el token enmascarado', () => {
    expect(buildMcpSnippet(config, '/x', 'ab…yz')).not.toContain(config.authToken);
  });

  it('el comando de registro usa el marcador de token, no el real', () => {
    const command = buildClaudeAddCommand(config, '/home/ana/kura3d');
    expect(command).toContain('-e KURA_BRIDGE_TOKEN=<TOKEN>');
    expect(command).not.toContain(config.authToken);
    expect(command).toContain('"/home/ana/kura3d/mcp-server/dist/index.js"');
  });
});

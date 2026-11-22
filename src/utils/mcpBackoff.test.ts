import { describe, expect, it } from 'vitest';
import { nextReconnectDelay, RECONNECT_DELAYS } from './mcpBridgeClient';

describe('espera creciente del puente MCP', () => {
  it('crece de forma exponencial y nunca supera el tope', () => {
    let delay: number = RECONNECT_DELAYS.min;
    const seen = [delay];
    for (let i = 0; i < 10; i += 1) {
      delay = nextReconnectDelay(delay);
      seen.push(delay);
    }
    expect(seen[1]).toBeGreaterThan(seen[0]);
    expect(Math.max(...seen)).toBe(RECONNECT_DELAYS.max);
    expect(seen[seen.length - 1]).toBe(RECONNECT_DELAYS.max);
  });
});

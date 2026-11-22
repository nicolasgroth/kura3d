/**
 * @file src/store/slices/aiMcpSlice.ts
 * @description Slice de IA y MCP: chat, configuración del proveedor (clave en almacén seguro),
 * configuración del puente MCP (token en almacén seguro, nunca en localStorage) y la hidratación
 * de ambos secretos al iniciar.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { StoreApi } from 'zustand';
import { loadKeyState, parseStoredAiConfig, persistableAiConfig } from '../../ai/aiConfigState';
import { loadAllowedHosts } from '../../ai/allowedHosts';
import { browserLocalStorage, getApiKeyStore, migrateLegacyApiKey } from '../../ai/apiKeyStore';
import { keySlotFor } from '../../ai/providerCatalog';
import { makeId } from '../../core/scene/sceneObjects';
import { t } from '../../i18n';
import type { AiConfig, McpConfig } from '../../types/kura';
import {
  forgetLegacyMcpToken,
  generateRandomTokenHex,
  getMcpTokenStore,
  readLegacyMcpToken,
  validateMcpToken,
} from '../../utils/mcpTokenStore';
import { hydrateMcpToken, parseStoredMcpConfig, persistableMcpConfig } from '../mcpConfigState';
import {
  loadInitialLanguage,
  readStorage,
  STORAGE_AI_CONFIG_KEY,
  STORAGE_MCP_CONFIG_KEY,
  writeStorage,
} from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

/**
 * Token MCP antiguo guardado en claro en localStorage: se retira al iniciar y se migra al almacén
 * seguro (llavero en escritorio, sessionStorage en web) durante la hidratación.
 */
const legacyMcpToken = readLegacyMcpToken(browserLocalStorage());

/** Clave antigua retirada de localStorage al iniciar (TRUST-03); null si no había. */
const legacyAiKey = migrateLegacyApiKey(browserLocalStorage(), STORAGE_AI_CONFIG_KEY, getApiKeyStore());

/** Configuración MCP inicial sin token (desactivada y protegida por defecto). */
function loadInitialMcpConfig(): McpConfig {
  const config = parseStoredMcpConfig(readStorage(STORAGE_MCP_CONFIG_KEY));
  return { ...config, authToken: legacyMcpToken ?? '' };
}

/** Configuración IA persistida; la clave API vive en `ai/apiKeyStore` (en escritorio, ni llega al webview). */
function loadInitialAiConfig(): AiConfig {
  const legacy = getApiKeyStore().desktop ? '' : legacyAiKey?.apiKey ?? '';
  return parseStoredAiConfig(readStorage(STORAGE_AI_CONFIG_KEY), legacy);
}

export function createAiMcpSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get } = ctx;

  /** Guarda el token MCP en su almacén seguro; avisa si falla. */
  const saveMcpToken = (token: string) => {
    getMcpTokenStore().save(token).catch(() => {
      get().addToast(t(get().language, 'dialog.settings.mcpTokenSaveFailed'), 'error');
    });
  };

  return {
    mcpConnected: false,
    mcpConfig: loadInitialMcpConfig(),
    aiDrawerOpen: false,
    aiConfig: loadInitialAiConfig(),
    aiMessages: [
      { id: 'welcome', role: 'assistant', content: t(loadInitialLanguage(), 'ai.welcome'), timestamp: Date.now() },
    ],
    aiBusy: false,

    setAiDrawerOpen: (aiDrawerOpen) => set({ aiDrawerOpen }),

    setAiConfig: (patch) =>
      set((state) => {
        let next: AiConfig = { ...state.aiConfig, ...patch };
        writeStorage(STORAGE_AI_CONFIG_KEY, JSON.stringify(persistableAiConfig(next)));
        if ('apiKey' in patch) {
          const keyStore = getApiKeyStore();
          const value = next.apiKey.trim();
          void keyStore.save(keySlotFor(next), value).catch(() => {
            if (keyStore.desktop) set((s) => ({ aiConfig: { ...s.aiConfig, keyStored: false } }));
            get().addToast(t(get().language, 'ai.error.keySaveFailed'), 'error');
          });
          // En escritorio la clave pasa al llavero y no queda en el webview.
          if (keyStore.desktop) next = { ...next, apiKey: '', keyStored: Boolean(value) };
        }
        return { aiConfig: next };
      }),

    setMcpConfig: (patch) => {
      const { authToken, ...rest } = patch;
      // Un token escrito a mano solo se acepta si el servidor lo aceptará (≥16 caracteres, sin espacios).
      const nextToken = authToken !== undefined && validateMcpToken(authToken.trim()) === 'ok'
        ? authToken.trim()
        : undefined;
      set((state) => {
        const nextPort =
          typeof rest.port === 'number' && Number.isFinite(rest.port)
            ? Math.min(65535, Math.max(1024, Math.round(rest.port)))
            : state.mcpConfig.port;
        const next: McpConfig = {
          ...state.mcpConfig,
          ...rest,
          ...(nextToken !== undefined ? { authToken: nextToken } : {}),
          port: nextPort,
          requireAuth: true,
        };
        writeStorage(STORAGE_MCP_CONFIG_KEY, persistableMcpConfig(next));
        return { mcpConfig: next };
      });
      if (nextToken !== undefined) saveMcpToken(nextToken);
    },

    regenerateMcpToken: () => {
      const token = generateRandomTokenHex(32);
      set((state) => ({ mcpConfig: { ...state.mcpConfig, authToken: token } }));
      saveMcpToken(token);
    },

    addAiMessage: (msg) =>
      set((state) => ({ aiMessages: [...state.aiMessages, { ...msg, id: makeId('msg'), timestamp: Date.now() }] })),

    clearAiMessages: () =>
      set((state) => ({
        aiMessages: [{ id: makeId('msg'), role: 'assistant', content: t(state.language, 'ai.welcome'), timestamp: Date.now() }],
      })),

    setAiBusy: (aiBusy) => set({ aiBusy }),
    setMcpConnected: (mcpConnected) => set({ mcpConnected }),
  };
}

/** Carga el token MCP y la clave IA desde sus almacenes seguros (migrando los antiguos). */
export function hydrateSecrets(store: StoreApi<KuraStoreState>): void {
  void (async () => {
    const { token, saved } = await hydrateMcpToken(getMcpTokenStore(), legacyMcpToken);
    // El token antiguo en claro se borra de localStorage solo cuando ya quedó en el almacén seguro.
    if (saved) forgetLegacyMcpToken(browserLocalStorage());
    const state = store.getState();
    // Si el usuario ya fijó un token en esta sesión, no se pisa.
    if (state.mcpConfig.authToken && state.mcpConfig.authToken !== (legacyMcpToken ?? '')) return;
    store.setState({ mcpConfig: { ...state.mcpConfig, authToken: token } });
    if (!saved) state.addToast(t(state.language, 'dialog.settings.mcpTokenSaveFailed'), 'error');
  })();

  void (async () => {
    if (legacyAiKey && !(await legacyAiKey.saved)) {
      const { addToast, language } = store.getState();
      addToast(t(language, 'ai.error.keySaveFailed'), 'error');
    }
    const keyStore = getApiKeyStore();
    if (keyStore.desktop) void loadAllowedHosts().catch(() => undefined);
    const initial = store.getState().aiConfig;
    if (initial.apiKey) return;
    const keyState = await loadKeyState(initial, keyStore);
    const current = store.getState().aiConfig;
    if (keySlotFor(current) === keySlotFor(initial) && !current.apiKey) {
      store.setState({ aiConfig: { ...current, ...keyState } });
    }
  })();
}

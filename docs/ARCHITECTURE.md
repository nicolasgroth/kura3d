# Arquitectura de Kura3D

Guía breve de capas y dependencias. La prueba `src/__tests__/dependencyRules.test.ts` hace cumplir la regla de dependencias.

## Capas

| Capa | Ruta | Responsabilidad |
|---|---|---|
| Motor | `src/engine/` | Geometría pura sobre Manifold WASM: primitivas, CSG, corte, ahuecado, moldes, roscas, análisis, formatos de archivo. Errores (`engineErrors.ts`) y límites (`primitiveLimits.ts`, `operationLimits.ts`) propios del motor. Texto 3D en `src/engine/text/`: fuente real (Roboto Bold, OFL) leída con opentype.js y cargada en diferido; `fontRegistry.ts` es el punto de extensión para más fuentes, `textOutlines.ts` maqueta y aplana contornos, `textCrossSection.ts` los pasa a Manifold (lo comparten la primitiva y la proyección). |
| Escena | `src/core/scene/` | Modelo de escena sin interfaz: construir objetos (`sceneObjects.ts`, con `ObjectBuildPolicy` para app y headless), reglas de bloqueo, vigencia y selección de objetivos (`sceneRules.ts`), nombres de resultados (`resultNames.ts`), resumen serializable (`sceneSummary.ts`). |
| Operaciones | `src/core/operations/` | Una función pura por operación: recibe objetos y opciones, llama al motor y devuelve un `SceneChange` (agregar, quitar, parchar + avisos). Sin `set`, sin toasts, sin i18n salvo claves. |
| Comandos | `src/core/commands/` | Contrato del Command Bus compartido por app y servidor MCP: nombres de comando y política lectura/escritura (`commandPolicy.ts`). |
| Store | `src/store/` | Zustand. `useKuraStore.ts` solo compone slices de `src/store/slices/` (documento, historial, selección/transformación, interfaz/preferencias, IA/MCP, importación/exportación, creación, geometría, piezas). `storeContext.ts` da a los slices historial, bloqueo, puerta exclusiva, avisos y el puente a `core/operations`. `commandBus.ts` traduce comandos a acciones. |
| Componentes | `src/components/` | React y react-three-fiber. Solo leen y llaman al store. |
| Servidor MCP | `mcp-server/` | stdio + puente WebSocket. En modo headless (`headlessEngine.ts`) usa las mismas funciones de `src/core/operations` con `HEADLESS_BUILD_POLICY` y sus nombres fijos (`headlessNaming.ts`). |
| Escritorio | `src-tauri/` | Rust/Tauri: archivos nativos, llavero, proxy IA. Habla con la web por comandos Tauri, no importa TypeScript. |

## Regla de dependencias

Una capa solo importa de las que están a su derecha:

```
components → store → core/operations → core/scene → engine
                  ↘ core/commands      ↘ types, i18n (solo claves)
mcp-server → core/*, engine, types, i18n
```

- `src/core/**` y `src/engine/**` no importan `src/store`, `src/components`, `react`, `zustand` ni `@react-three/*`.
- `src/core/**` tampoco importa `src/utils` ni `src/ai` (utilidades de interfaz). Lo que dependa del idioma activo entra como función (ver `createKeyedNaming`).
- `src/core/commands` no importa el motor ni la escena: es un contrato puro.
- Nada en `src/` importa de `mcp-server/`. El servidor importa de `src/`, nunca al revés.
- Las diferencias entre app y headless (estadísticas locales o de mundo, posición por defecto, nombres) se expresan con `ObjectBuildPolicy` y `ResultNaming`, no con copias de la lógica.

## Agregar una operación nueva

1. **Motor** (si hace falta geometría nueva): función en `src/engine/` que reciba `SceneObject`/`MeshData` y devuelva malla(s) y posición. Errores con `EngineError` y un código de `engineErrors.ts`; límites en `operationLimits.ts`. Pruebas en `src/engine/__tests__/` (manifold, volumen y dimensiones).
2. **Operación pura**: función en el archivo de `src/core/operations/` que corresponda (`csg`, `mesh`, `part` o `creation`; uno nuevo si no encaja y el archivo pasaría de ~400 líneas). Firma `(ctx: OperationContext, obj, options) → SceneChange` (o `{ result, change }`). Usa `buildWith` para objetos nuevos, `meshPatch` para reemplazar mallas y `ctx.naming` para nombres (agrega el método a `ResultNaming` e impleméntalo en `createKeyedNaming` y en `mcp-server/src/headlessNaming.ts`). Prueba en `src/core/__tests__/`.
3. **Store**: acción en el slice que corresponda de `src/store/slices/`, declarada en `KuraStoreState` (`src/store/storeTypes.ts`). Patrón: validar bloqueo (`editable`, `rejectWhileLocked`) → `runExclusive(nombre, valorSiFalla, async () => { … })` → operación → `assertCurrent(entradas)` → `commitChange(change, { select, spawned })` → toast con clave i18n (6 idiomas) → `reportEngineWarnings(change.warnings)`.
4. **Command Bus**: nombre en `src/core/commands/commandNames.ts`, acceso en `COMMAND_ACCESS` (y `TOOL_COMMANDS` si hay herramienta MCP), esquema en `src/store/commandSchemas.ts` y manejador en `src/store/commandBus.ts`.
5. **Servidor MCP**: herramienta en `mcp-server/src/tools.ts` con esquema Zod; en headless, método en `headlessEngine.ts` que llame a la misma operación de `src/core/operations` y aplique el cambio con `apply`.
6. Corre `npx tsc -b`, `npx vitest run`, `npm --prefix mcp-server run build` y `npm --prefix mcp-server run test`.

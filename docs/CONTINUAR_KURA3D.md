# Continuidad de Kurra Studio

Actualizado el 21 de noviembre de 2026. Abrir el repositorio `G:/proyectos/kura3d` en el chat nuevo y tomar como base `codex/kura3d-proyectos-ux`. La rama parte de `main` en `9c875ba`. El destino Git es `origin`, repositorio `nicolasgroth/kurra3d`. La versión declarada sigue siendo 0.5.0 y los cambios de esta entrega están agrupados bajo «Sin publicar».

[Backlog completo y registro de calidad](PLAN_DESARROLLO.md) · [Changelog](../CHANGELOG.md)

## Punto de partida comprobado

| Entrega | Estado | Evidencia y límites |
|---|---|---|
| UX-01 · teclado, Zen y visor adaptable | 86,4/100 del alcance web | Foco con Tab, salida de Zen, viewport estrecho y notificaciones fuera de los controles. |
| I1-A · proyectos `.kura` v1 | 91,3/100 | Guardado, apertura, historial y exportación. QA en Edge y Windows nativo para diálogo, escritura atómica y aviso de cierre. El codec de proyectos usa un Worker. Una descarga web sin confirmación de escritura conserva el indicador de cambios. |
| I1-B web · escena vacía y arrastre | 91,5/100 | Cubo de ejemplo reversible y lotes STL/3MF/OBJ que agregan o deshacen juntos. Los lotes inválidos conservan la escena. `.kura` abre como proyecto. Tauri compila, falta repetir el gesto físico de arrastre. |
| PREC-01 · `M/R/S` | 91,7/100 en web | Mover y Rotar absolutos o por delta, escala por tamaño local o factor, vínculo proporcional y un Deshacer por edición confirmada. `G/W` mantienen el gizmo y `Shift+M` abre Molde. |
| RECOVER-01 · recuperación local | 91,5/100 en web | Borradores IndexedDB por editor, transacciones de metadatos y bytes, recuperación como copia sin ruta autorizada y descarte específico. Edge verificó dos pestañas, una descarga bloqueada y un guardado confirmado con selector/stream simulados. Falta validar reinicio y aviso con recuperación en un binario Tauri instalado. |

El `.kura` actual guarda una escena, objetos, materiales y pintura, transformaciones, unidades, selección e historial. Los perfiles de placa editables, instancias enlazadas y pestañas independientes tienen sus propias tareas. En recuperación se ofrece la última copia local que alcanzó a guardarse en ese navegador o WebView. Los borradores permanecen separados por origen. `localhost:5189`, `127.0.0.1:5189` y la aplicación empaquetada tienen almacenamientos distintos.

## Primer bloque del chat nuevo

1. **UX-08 y UX-06/07.** Validar con la interfaz actual el recorrido Expandido → Compacto → Expandido y la entrada/salida de Zen desde ambos. El control de la barra superior cicla por los tres estados y la barra se oculta en Zen. El atajo de salida restaura la densidad anterior y el botón del visor fuerza Expandido. Las reglas responsivas ocultan etiquetas de la cabecera a 1240 px o menos. Probar dos variantes de iconografía y distribución de barras superiores/laterales sobre la misma aplicación. Comparar cómo se encuentran Importar, Agregar, Seleccionar, Mover, Pintar, Cortar y el control de retorno. Mantener nombres accesibles, tooltips al enfocar, atajos y registro común de comandos. Definir una selección explícita entre vista con etiquetas y vista de iconos, con Zen como acción separada y retorno visible al modo anterior. Probar en 390, 1024, 1241 y escritorio con español e inglés, teclado y paneles abiertos. [Barra superior](../src/components/TopBar.tsx) · [Botón de salida](../src/components/Viewport3D.tsx) · [Preferencia de densidad](../src/store/useKuraStore.ts)
2. **DROP-01 nativo y RECOVER-01 nativo.** Usar Windows y archivos sintéticos. Soltar un STL y un `.kura` desde el Explorador. Comprobar permisos del plugin FS, aviso de descarte, reapertura y un solo Deshacer por lote. Verificar borrador en el WebView instalado tras terminar el proceso después del indicador de copia local. Probar cierre con cambios mediante No/Sí y que descartar un borrador no afecte un `.kura` guardado. Confirmar que el aviso de autoguardado cabe en ventanas estrechas y que los recorridos de navegador se incorporen a pruebas reutilizables.
3. **IO-01a.** Conectar la opción de importar conservando posición y altura, con el modo actual de centrar/apoyar como alternativa. Después seguir con instancias y componentes 3MF, bandejas virtuales, distribución y exportación por bandeja. La sección de placas del plan enumera los modos y casos de prueba.
4. **TRUST-01 a TRUST-04 en paralelo.** Revisar CSP y comandos nativos existentes, política de solo lectura y rotación MCP, secretos y dependencias. El backlog distingue el puente local de una eventual API pública. Estas revisiones tienen sus propias pruebas y son previas a una beta pública.

Después siguen camas personalizadas, pestañas y paneles, ensamblajes con conectores vinculados, CLI y capturas sin ventana, voz en español/inglés y extensiones limitadas. La secuencia, dependencias y criterios por tarea están en el plan maestro del repositorio.

## Trabajo de importación conservado aparte

El trabajo de `IO-01a` quedó guardado localmente en Git con ID `fc7583691edd67af876cffd0e82e51232e364d9b`. Contiene solamente `src/engine/ioFormats.ts` y `src/engine/__tests__/importPlacement.test.ts`. Se puede aplicar sobre una rama de trabajo derivada de `codex/kura3d-proyectos-ux` con `git stash apply fc7583691edd67af876cffd0e82e51232e364d9b`. El stash acompaña al repositorio local de Windows. Si se retoma desde un clon remoto, este es el contrato suficiente para reconstruir el avance:

- Opción común `preservePlacement` en los importadores STL, OBJ y 3MF. El comportamiento predeterminado actual centra y apoya. Con la opción activada, el lector entrega coordenadas de escena en mm, convierte los ejes según el formato y conserva las transformaciones 3MF que ya interpreta.
- Al integrar con `parseModelBufferToMeshes`, normalizar el pivote local y aplicar al objeto la compensación mundial calculada a partir del centro X/Z y el mínimo Y originales. Así el inspector presenta la altura y el encuadre mantiene el centro real. Aplicar la misma elección a la importación desde diálogo y por arrastre, sin cambiar el anclaje de un módulo aditivo o sustractivo sobre una pieza.
- Comprobar ida y vuelta de alturas X/Y/Z, unidades y orientación. Probar al menos un STL elevado y un 3MF con transformación de construcción. Las referencias anidadas, instancias repetidas y extensiones de 3MF permanecen en `IO-01` y llevan sus propios fixtures.

## Cómo comprobar y cerrar cada entrega

La validación final de la rama incluye 114 pruebas del frontend, 9 de MCP, 4 de escritura nativa, compilación web y comprobación de Rust. El último smoke en Edge distinguió borradores con el mismo nombre y hora y verificó que, al guardar o reemplazar la escena, el aviso no muestra la copia ya retirada.

```powershell
npm test
npm run mcp:test
npm run build
cargo check --offline --locked --manifest-path src-tauri/Cargo.toml
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib project_files::tests
git diff --check
```

La vista web de trabajo estuvo en `http://localhost:5189/`, con Vite activo. Para levantarla en ese puerto desde la raíz del repositorio, ejecutar `& './node_modules/.bin/vite.cmd' --host 127.0.0.1 --port 5189 --strictPort`. Usar la pestaña integrada para revisar interfaz y foco. Reservar Tauri para los recorridos realmente nativos. Usar perfiles aislados en pruebas que cambien borradores o estado del proyecto.

En cada lote, actualizar el estado y el registro de `PLAN_DESARROLLO.md` y el cambio observable en `CHANGELOG.md`. Mantener implementación, QA y evaluación separados. Puntuar de 1 a 100, con 85 mínimo y 90 como meta. Tras cinco evaluaciones bajo el mínimo para un mismo lote, registrar una consulta en `docs/CONSULTAS_PROYECTO.md` antes de una sexta ronda. Crear ese archivo cuando exista una decisión importante que requiera al usuario. El trabajo de esta entrega está en la rama de Git indicada y el alcance nativo pendiente permanece identificado en el backlog.

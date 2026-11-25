# Extensiones de Kurra Studio

**Estado: diseño propuesto.** El sistema de extensiones todavía no está implementado (ticket EXT-01). Este documento fija las reglas para que el núcleo se construya desde ya de forma compatible, y para que quien quiera aportar sepa qué esperar. Puede cambiar hasta la primera versión que lo incluya.

## Qué es una extensión

Un paquete hecho por un tercero que agrega funciones a Kurra Studio sin modificar su código. Usa el mismo contrato de operaciones que la interfaz, la línea de comandos, el servidor MCP y la API: una extensión no puede hacer nada que un usuario no pueda hacer, y todo lo que hace queda en el historial y se puede deshacer.

## Qué puede agregar

| Tipo | Ejemplo | Disponible desde |
|---|---|---|
| Generador | Engranaje, bisagra, caja con divisiones | Primera versión |
| Preset | Conectores, perfiles de cama, materiales | Primera versión |
| Comando | Una receta que encadena operaciones existentes | Primera versión |
| Importador o exportador | Un formato nuevo | Segunda etapa |
| Panel | Una vista propia dentro del estudio | Segunda etapa |
| Idioma | Traducción completa | Primera versión, sin código |

El formato de las recetas (comandos sin código) está en [recetas/FORMATO.md](recetas/FORMATO.md).

## Reglas

1. **Sin acceso por defecto.** Una extensión no ve archivos, red, credenciales ni otras extensiones. Cada permiso se declara en el manifiesto y el usuario lo aprueba al instalar.
2. **Aislada.** Corre en un Worker propio, sin acceso al DOM ni al almacenamiento de la app. Se comunica solo por mensajes validados con esquema.
3. **Solo el contrato público.** Llama operaciones por nombre con parámetros validados (los mismos esquemas del bus de comandos). No importa módulos internos.
4. **Geometría válida.** Lo que devuelve un generador pasa por la misma validación que una importación: malla cerrada, índices válidos, valores finitos, límites de tamaño.
5. **Un fallo no rompe el proyecto.** Un error o un tiempo excedido cancela la operación de la extensión y deja la escena como estaba. Los proyectos se abren aunque falte la extensión que creó un objeto: la geometría ya está materializada.
6. **Identificada.** Nombre, autor, versión y licencia siempre visibles. Lo creado por una extensión queda marcado con su procedencia.
7. **Reversible.** Se puede desactivar y desinstalar sin dejar residuos.
8. **Licencia abierta y compatible.** MIT, Apache-2.0, BSD, ISC o MPL-2.0 para entrar al catálogo oficial.
9. **Textos traducibles.** Los textos visibles van en archivos por idioma, con español e inglés como mínimo.
10. **Sin telemetría** ni llamadas a servicios externos sin permiso de red declarado y aprobado.

## Manifiesto propuesto

```json
{
  "id": "autor.nombre-extension",
  "name": "Engranajes",
  "version": "1.0.0",
  "author": "Nombre",
  "license": "MIT",
  "kura": ">=0.6.0",
  "entry": "main.js",
  "permissions": [],
  "contributes": {
    "generators": [{ "id": "gear", "title": { "es": "Engranaje", "en": "Gear" } }],
    "presets": [],
    "commands": []
  }
}
```

Permisos previstos: `scene:read`, `scene:write`, `files:import`, `files:export`, `network:<host>`. Sin `scene:write` una extensión solo puede proponer; el usuario aplica.

## Agregar un idioma

No requiere código. Se copia `src/i18n/locales/en.ts` con el código del idioma nuevo, se traducen los valores y se registra el idioma. La prueba `src/i18n/translations.test.ts` verifica que no falten claves ni marcadores. Los idiomas de derecha a izquierda están previstos en el ticket I18N-01.

## Qué necesita el núcleo antes

- Contrato único de operaciones con esquemas versionados (API-01).
- Núcleo independiente de la interfaz (CORE-02).
- Historial con procedencia (HIST-01).
- Cargador con permisos y aislamiento (EXT-01).

# Política de Seguridad — Kurra3D Studio

**Organización:** ISGROTH — Innovación y Soluciones GROTH  
**Mantenedor:** Nicolás Groth (`ngroth@gmail.com`)

---

## Modelo de Seguridad de Kurra3D Studio

Kurra3D Studio está diseñado desde su base con privacidad y seguridad local primero:

1. **Sin claves ni credenciales embebidas:** El código fuente nunca almacena API keys ni tokens. Las credenciales del Chat IA opcional son ingresadas exclusivamente por el usuario en su dispositivo.
2. **Puente MCP restringido a `127.0.0.1`:** El servidor WebSocket local (`KURA_BRIDGE_PORT`, por defecto `17432`) se enlaza exclusivamente a la interfaz loopback (`127.0.0.1`) y valida la cabecera `Origin` para rechazar orígenes remotos no autorizados (HTTP 403).
3. **Permisos mínimos en Tauri v2:** Las capacidades definidas en `src-tauri/capabilities/default.json` limitan el acceso nativo únicamente a los plugins de diálogo y sistema de archivos requeridos para abrir y exportar modelos 3D.
4. **Geometría 100 % local y open-source:** Todas las operaciones CAD/CSG (Manifold-3D, SVG, Imagen→3D, texturas, pintado, STL/3MF/OBJ) se ejecutan localmente sin enviar modelos a servidores externos.

---

## Reporte de Vulnerabilidades

Si descubres una vulnerabilidad de seguridad en Kurra3D Studio o en su servidor MCP:

- **No abras un Issue público** con detalles explotables.
- Envía un reporte privado a **Nicolás Groth (`ngroth@gmail.com`)** indicando en el asunto `[SECURITY][Kurra3D Studio]`, con pasos de reproducción e impacto estimado.
- También puedes utilizar **GitHub Private Vulnerability Reporting** en el repositorio oficial: `https://github.com/nicolasgroth/kurra3d/security`.

Confirmaremos la recepción en un plazo objetivo de **72 horas** y coordinaremos la publicación responsable del parche.

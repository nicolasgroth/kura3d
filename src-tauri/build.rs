// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Script de compilación de Tauri v2 encargado de generar metadatos,
// recursos de Windows (icono y manifiesto) y permisos de capacidades. Declara los
// comandos propios para que solo los listados en `capabilities/` sean invocables.

const COMMANDS: &[&str] = &[
    "get_app_info",
    "get_mcp_bridge_status",
    "open_kura_project",
    "save_kura_project",
    "ai_key_status",
    "ai_key_set",
    "ai_key_delete",
    "ai_http_request",
    "ai_http_cancel",
    "ai_allowed_hosts_get",
    "ai_allowed_hosts_set",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("Error al generar el contexto de compilación de Tauri");
}

// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Script de compilación de Tauri v2 encargado de generar metadatos,
// recursos de Windows (icono y manifiesto) y permisos de capacidades. Declara los
// comandos propios para que solo los listados en `capabilities/` sean invocables.

const COMMANDS: &[&str] = &[
    "open_kura_project",
    "save_kura_project",
    "recent_projects_list",
    "recent_project_open",
    "recent_projects_remove",
    "recent_projects_clear",
    "recent_projects_set_enabled",
    "ai_key_status",
    "ai_key_set",
    "ai_key_delete",
    "mcp_token_get",
    "mcp_token_set",
    "mcp_token_delete",
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

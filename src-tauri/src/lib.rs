// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Módulo principal del backend nativo de Kurra3D Studio sobre Tauri v2.
// Expone los comandos de proyectos .kura (y su registro de recientes), el almacén de claves IA del sistema operativo y el
// proxy HTTP nativo hacia proveedores IA (la CSP del webview no abre hosts remotos).

mod ai_credentials;
mod ai_hosts;
mod ai_proxy;
mod mcp_credentials;
mod project_files;
mod recent_projects;
mod save_confirmation;

/// Inicializa y ejecuta la aplicación Tauri v2 registrando plugins nativos y comandos IPC.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Diálogos nativos (abrir/guardar modelos, SVG, imágenes y confirmaciones)
        .plugin(tauri_plugin_dialog::init())
        // Lectura/escritura solo de rutas elegidas en diálogos o soltadas en la ventana
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            use tauri::Manager;
            // Registro persistente de rutas de proyectos recientes (en el directorio de datos de la app)
            app.manage(recent_projects::RecentStore::new(app.path().app_data_dir()?));
            Ok(())
        })
        .manage(project_files::ProjectLocations::default())
        .manage(ai_proxy::AiProxyState::default())
        // Comandos nativos expuestos vía IPC (`invoke`); la lista coincide con build.rs
        .invoke_handler(tauri::generate_handler![
            project_files::open_kura_project,
            project_files::save_kura_project,
            recent_projects::recent_projects_list,
            recent_projects::recent_project_open,
            recent_projects::recent_projects_remove,
            recent_projects::recent_projects_clear,
            recent_projects::recent_projects_set_enabled,
            ai_credentials::ai_key_status,
            ai_credentials::ai_key_set,
            ai_credentials::ai_key_delete,
            mcp_credentials::mcp_token_get,
            mcp_credentials::mcp_token_set,
            mcp_credentials::mcp_token_delete,
            ai_proxy::ai_http_request,
            ai_proxy::ai_http_cancel,
            ai_proxy::ai_allowed_hosts_get,
            ai_proxy::ai_allowed_hosts_set,
        ])
        .run(tauri::generate_context!())
        .expect("Error crítico al iniciar el runtime nativo de Kurra3D Studio");
}


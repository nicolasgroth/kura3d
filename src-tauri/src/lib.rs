// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Módulo principal del backend nativo de Kura3D sobre Tauri v2.
// Expone metadatos de la aplicación, la verificación del puente local MCP, los
// comandos de proyectos .kura y el almacén de claves IA del sistema operativo.

use serde::Serialize;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

mod ai_credentials;
mod project_files;

/// Puertos aceptados para el puente MCP (mismo rango que la configuración del frontend).
const MCP_PORTS: std::ops::RangeInclusive<u16> = 1024..=65535;

/// Metadatos nativos de la aplicación devueltos al frontend web/Tauri.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub author: &'static str,
    pub organization: &'static str,
    pub email: &'static str,
    pub platform: &'static str,
    pub native: bool,
}

/// Estado de conectividad del puente WebSocket local utilizado por el servidor MCP.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpBridgeStatus {
    pub host: String,
    pub port: u16,
    pub reachable: bool,
}

/// Devuelve información básica de identidad, autoría y plataforma nativa de Kura3D.
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Kura3D",
        version: "0.5.0",
        author: "Nicolás Groth",
        organization: "ISGROTH — Innovación y Soluciones GROTH",
        email: "ngroth@gmail.com",
        platform: std::env::consts::OS,
        native: true,
    }
}

/// Comprueba de forma rápida y no bloqueante si el servidor puente MCP está escuchando
/// en `127.0.0.1` (puerto por defecto 17432). Solo acepta puertos no privilegiados.
#[tauri::command]
fn get_mcp_bridge_status(port: Option<u16>) -> Result<McpBridgeStatus, String> {
    let target_port = port.unwrap_or(17432);
    if !MCP_PORTS.contains(&target_port) {
        return Err("Puerto MCP fuera de rango.".into());
    }
    let addr: SocketAddr = ([127, 0, 0, 1], target_port).into();
    let reachable = TcpStream::connect_timeout(&addr, Duration::from_millis(120)).is_ok();

    Ok(McpBridgeStatus {
        host: "127.0.0.1".to_string(),
        port: target_port,
        reachable,
    })
}

/// Inicializa y ejecuta la aplicación Tauri v2 registrando plugins nativos y comandos IPC.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Diálogos nativos (abrir/guardar modelos, SVG, imágenes y confirmaciones)
        .plugin(tauri_plugin_dialog::init())
        // Lectura/escritura solo de rutas elegidas en diálogos o soltadas en la ventana
        .plugin(tauri_plugin_fs::init())
        .manage(project_files::ProjectLocations::default())
        // Comandos nativos expuestos vía IPC (`invoke`); la lista coincide con build.rs
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_mcp_bridge_status,
            project_files::open_kura_project,
            project_files::save_kura_project,
            ai_credentials::ai_key_get,
            ai_credentials::ai_key_set,
            ai_credentials::ai_key_delete,
        ])
        .run(tauri::generate_context!())
        .expect("Error crítico al iniciar el runtime nativo de Kura3D");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mcp_status_rejects_privileged_ports() {
        assert!(get_mcp_bridge_status(Some(0)).is_err());
        assert!(get_mcp_bridge_status(Some(80)).is_err());
        assert!(get_mcp_bridge_status(Some(1023)).is_err());
        assert_eq!(get_mcp_bridge_status(Some(1024)).unwrap().port, 1024);
    }
}

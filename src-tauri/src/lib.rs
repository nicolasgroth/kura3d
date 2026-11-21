// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Módulo principal del backend nativo de Kura3D sobre Tauri v2.
// Expone comandos de alto rendimiento para lectura/escritura binaria (STL/3MF),
// consulta de metadatos de la aplicación y verificación del puente local MCP.

use serde::Serialize;
use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::time::Duration;

mod project_files;

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

/// Escribe un buffer binario completo (por ejemplo, mallas STL binarias o archivos 3MF)
/// directamente en disco creando los directorios padres si aún no existen.
#[tauri::command]
fn write_binary_file_native(path: String, bytes: Vec<u8>) -> Result<usize, String> {
    let target = Path::new(&path);

    // Garantiza que la carpeta destino exista antes de escribir el archivo
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|err| {
                format!(
                    "No se pudo crear el directorio destino '{}': {}",
                    parent.display(),
                    err
                )
            })?;
        }
    }

    fs::write(target, &bytes).map_err(|err| {
        format!(
            "Error al escribir el archivo binario '{}': {}",
            target.display(),
            err
        )
    })?;

    Ok(bytes.len())
}

/// Lee un archivo binario desde el sistema de archivos local con retorno directo
/// de bytes hacia el motor de geometría del frontend (importación STL/3MF/OBJ).
#[tauri::command]
fn read_binary_file_native(path: String) -> Result<Vec<u8>, String> {
    let target = Path::new(&path);

    fs::read(target).map_err(|err| {
        format!(
            "Error al leer el archivo binario '{}': {}",
            target.display(),
            err
        )
    })
}

/// Comprueba de forma rápida y no bloqueante si el servidor puente MCP está escuchando
/// en `127.0.0.1` (puerto por defecto 17432).
#[tauri::command]
fn get_mcp_bridge_status(port: Option<u16>) -> McpBridgeStatus {
    let target_port = port.unwrap_or(17432);
    let host = "127.0.0.1".to_string();
    let addr: SocketAddr = ([127, 0, 0, 1], target_port).into();
    let timeout = Duration::from_millis(120);

    let reachable = TcpStream::connect_timeout(&addr, timeout).is_ok();

    McpBridgeStatus {
        host,
        port: target_port,
        reachable,
    }
}

/// Inicializa y ejecuta la aplicación Tauri v2 registrando plugins nativos y comandos IPC.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Diálogos nativos de sistema (abrir/guardar STL, 3MF, SVG, imágenes)
        .plugin(tauri_plugin_dialog::init())
        // Acceso seguro al sistema de archivos según capacidades declaradas
        .plugin(tauri_plugin_fs::init())
        .manage(project_files::ProjectLocations::default())
        // Comandos nativos expuestos vía IPC (`invoke`)
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            write_binary_file_native,
            read_binary_file_native,
            get_mcp_bridge_status,
            project_files::open_kura_project,
            project_files::save_kura_project,
        ])
        .run(tauri::generate_context!())
        .expect("Error crítico al iniciar el runtime nativo de Kura3D");
}

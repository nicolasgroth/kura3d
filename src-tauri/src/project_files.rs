// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Comandos nativos de Tauri para abrir y guardar proyectos .kura con
// autorización de rutas por sesión, escritura atómica y límite de tamaño.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tempfile::NamedTempFile;
use uuid::Uuid;

// Keep this limit in sync with MAX_PROJECT_BYTES in the web project codec.
const MAX_PROJECT_BYTES: usize = 128 * 1024 * 1024;
const MAX_METADATA_BYTES: usize = 64 * 1024;
const TOO_LARGE: &str = "kura-project-too-large";

/// Tracks files chosen in the main window for the lifetime of the desktop process.
#[derive(Default)]
pub struct ProjectLocations(Mutex<HashMap<String, PathBuf>>);

impl ProjectLocations {
    fn remember(&self, target: PathBuf) -> Result<String, String> {
        let mut locations = self.0.lock().map_err(|err| err.to_string())?;
        if let Some((location, _)) = locations.iter().find(|(_, path)| **path == target) {
            return Ok(location.clone());
        }
        let location = Uuid::new_v4().to_string();
        locations.insert(location.clone(), target);
        Ok(location)
    }

    fn resolve(&self, location: &str) -> Result<PathBuf, String> {
        self.0
            .lock()
            .map_err(|err| err.to_string())?
            .get(location)
            .cloned()
            .ok_or_else(|| "El destino original de este proyecto ya no está disponible.".into())
    }
}

#[derive(Deserialize)]
struct SaveRequest {
    name: String,
    location: Option<String>,
}

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    location: String,
}

fn project_dialog(
    window: &WebviewWindow,
) -> Result<tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>, String> {
    if window.label() != "main" {
        return Err("El diálogo de proyectos requiere la ventana principal.".into());
    }
    let dialog = window.dialog().file().add_filter("Kura3D", &["kura"]);
    #[cfg(desktop)]
    let dialog = dialog.set_parent(window);
    Ok(dialog)
}

fn is_project_path(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("kura"))
}

fn selected_path(selected: FilePath) -> Result<PathBuf, String> {
    let path = selected.into_path().map_err(|err| err.to_string())?;
    if !is_project_path(&path) {
        return Err("Elige un archivo con extensión .kura.".into());
    }
    let parent = path.parent().ok_or("El archivo no tiene directorio.")?;
    let name = path.file_name().ok_or("El archivo no tiene nombre.")?;
    let parent = parent.canonicalize().map_err(|err| err.to_string())?;
    Ok(parent.join(name))
}

fn file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "El archivo no tiene nombre.".into())
}

// A four-byte little-endian length followed by UTF-8 JSON and raw project bytes
// avoids encoding large geometry buffers as JSON arrays over IPC.
fn read_save_request(body: &InvokeBody) -> Result<(SaveRequest, &[u8]), String> {
    let InvokeBody::Raw(body) = body else {
        return Err("El proyecto debe enviarse como datos binarios.".into());
    };
    let (length, rest) = body
        .split_first_chunk::<4>()
        .ok_or("Solicitud de guardado incompleta.")?;
    let length = u32::from_le_bytes(*length) as usize;
    if length > MAX_METADATA_BYTES || length > rest.len() {
        return Err("Metadatos de guardado inválidos.".into());
    }
    let (metadata, bytes) = rest.split_at(length);
    if bytes.len() > MAX_PROJECT_BYTES {
        return Err(TOO_LARGE.into());
    }
    let request = serde_json::from_slice(metadata).map_err(|err| err.to_string())?;
    Ok((request, bytes))
}

fn write_atomically(
    target: &Path,
    write: impl FnOnce(&mut File) -> io::Result<()>,
) -> io::Result<()> {
    match fs::symlink_metadata(target) {
        Ok(metadata) if !metadata.is_file() => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "El destino no es un archivo normal.",
            ));
        }
        Err(err) if err.kind() != io::ErrorKind::NotFound => return Err(err),
        _ => {}
    }
    let parent = target.parent().ok_or(io::ErrorKind::InvalidInput)?;
    let mut temporary = NamedTempFile::new_in(parent)?;
    write(temporary.as_file_mut())?;
    temporary.as_file().sync_all()?;
    temporary.persist(target)?;
    Ok(())
}

#[tauri::command]
pub async fn open_kura_project(window: WebviewWindow) -> Result<Response, String> {
    let Some(selected) = project_dialog(&window)?.blocking_pick_file() else {
        return Ok(Response::new(Vec::<u8>::new()));
    };
    let target = selected_path(selected)?;
    let metadata = fs::symlink_metadata(&target).map_err(|err| err.to_string())?;
    if !metadata.is_file() {
        return Err("El proyecto debe ser un archivo normal.".into());
    }
    if metadata.len() > MAX_PROJECT_BYTES as u64 {
        return Err(TOO_LARGE.into());
    }

    let file = File::open(&target).map_err(|err| err.to_string())?;
    let name = file_name(&target)?;
    let location = window.state::<ProjectLocations>().remember(target)?;
    let metadata_bytes =
        serde_json::to_vec(&ProjectFile { name, location }).map_err(|err| err.to_string())?;
    let prefix_len = 4 + metadata_bytes.len();
    let mut response = Vec::with_capacity(prefix_len + metadata.len() as usize);
    response.extend_from_slice(&(metadata_bytes.len() as u32).to_le_bytes());
    response.extend_from_slice(&metadata_bytes);
    file.take(MAX_PROJECT_BYTES as u64 + 1)
        .read_to_end(&mut response)
        .map_err(|err| err.to_string())?;
    if response.len() - prefix_len > MAX_PROJECT_BYTES {
        return Err(TOO_LARGE.into());
    }
    Ok(Response::new(response))
}

#[tauri::command]
pub async fn save_kura_project(
    window: WebviewWindow,
    request: Request<'_>,
) -> Result<Option<ProjectFile>, String> {
    let dialog = project_dialog(&window)?;
    let (request, bytes) = read_save_request(request.body())?;
    let locations = window.state::<ProjectLocations>();
    let target = if let Some(location) = request.location {
        locations.resolve(&location)?
    } else {
        let name = Path::new(&request.name);
        if !matches!(name.components().next(), Some(Component::Normal(_)))
            || name.file_name() != Some(name.as_os_str())
            || !is_project_path(name)
        {
            return Err("El nombre del proyecto debe tener extensión .kura.".into());
        }
        let Some(selected) = dialog.set_file_name(request.name).blocking_save_file() else {
            return Ok(None);
        };
        selected_path(selected)?
    };
    let name = file_name(&target)?;
    write_atomically(&target, |file| file.write_all(bytes)).map_err(|err| err.to_string())?;
    let location = locations.remember(target)?;
    Ok(Some(ProjectFile { name, location }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_write_preserves_previous_project_and_removes_temporary_file() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();

        let result = write_atomically(&project, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("write failed"))
        });

        assert!(result.is_err());
        assert_eq!(fs::read(&project).unwrap(), b"original");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn successful_write_replaces_existing_project() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();

        write_atomically(&project, |file| file.write_all(b"new")).unwrap();

        assert_eq!(fs::read(&project).unwrap(), b"new");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn locked_destination_survives_failed_replacement() {
        use std::os::windows::fs::OpenOptionsExt;

        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&project)
            .unwrap();

        let result = write_atomically(&project, |file| file.write_all(b"new"));

        drop(lock);
        assert!(result.is_err());
        assert_eq!(fs::read(&project).unwrap(), b"original");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn location_has_to_match_a_previously_selected_file() {
        let locations = ProjectLocations::default();
        let path = PathBuf::from("modelo.kura");
        assert!(locations.resolve("modelo.kura").is_err());
        let location = locations.remember(path.clone()).unwrap();
        assert_eq!(locations.resolve(&location).unwrap(), path);
        assert_eq!(locations.remember(path).unwrap(), location);
    }
}

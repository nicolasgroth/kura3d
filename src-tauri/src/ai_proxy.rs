// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Proxy HTTP nativo para proveedores IA (comando `ai_http_request`).
// Mantiene cerrada la CSP del webview: las llamadas salen desde Rust con rustls,
// solo hacia https (o http a loopback) en hosts de la lista que el usuario
// confirma, sin redirecciones a otros hosts y con límites de tamaño y tiempo.
// La clave se lee del llavero aquí mismo y se adjunta según la ranura; nunca
// vuelve al webview: se borra del cuerpo de la respuesta y los errores son códigos.

use crate::ai_credentials::{get_key, OsSecretStore, SecretStore};
use crate::ai_hosts::{self, check_slot_host, validate_target, AuthScheme};
use reqwest::{redirect, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, Once};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::oneshot;
use url::Url;

pub const MAX_REQUEST_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 180_000;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_REDIRECTS: usize = 3;
const MAX_HEADERS: usize = 12;
const MAX_HEADER_VALUE: usize = 512;
/// Cabeceras que el webview puede fijar. Las de autenticación las pone solo Rust.
const ALLOWED_HEADERS: &[&str] = &[
    "content-type",
    "accept",
    "anthropic-version",
    "http-referer",
    "x-openrouter-title",
];
const HOSTS_FILE: &str = "ai-allowed-hosts.json";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpRequest {
    pub request_id: String,
    pub url: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub key_slot: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct AiHttpResponse {
    pub status: u16,
    pub body: String,
}

/// Solicitud ya validada, lista para enviarse.
pub struct Prepared {
    url: Url,
    method: Method,
    headers: Vec<(String, String)>,
    body: Option<String>,
    secret: Option<(AuthScheme, String)>,
    timeout: Duration,
}

/// Procesos en curso (para cancelar) y caché de la lista de hosts.
#[derive(Default)]
pub struct AiProxyState {
    inflight: Mutex<HashMap<String, oneshot::Sender<()>>>,
    hosts: Mutex<Option<Vec<String>>>,
}

fn ensure_crypto_provider() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        let _ = rustls::crypto::ring::default_provider().install_default();
    });
}

fn valid_request_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Valida destino, método, cabeceras, cuerpo y ranura de clave. Lee la clave del almacén.
pub fn prepare(req: &AiHttpRequest, allowed: &[String], store: &impl SecretStore) -> Result<Prepared, String> {
    let url = validate_target(&req.url, allowed)?;
    let method = match req.method.as_deref().unwrap_or("POST") {
        "POST" => Method::POST,
        "GET" => Method::GET,
        _ => return Err("ai-proxy-method-not-allowed".into()),
    };
    if req.headers.len() > MAX_HEADERS {
        return Err("ai-proxy-header-not-allowed".into());
    }
    let mut headers = Vec::new();
    for (name, value) in &req.headers {
        let name = name.to_ascii_lowercase();
        if !ALLOWED_HEADERS.contains(&name.as_str())
            || value.len() > MAX_HEADER_VALUE
            || value.chars().any(char::is_control)
        {
            return Err("ai-proxy-header-not-allowed".into());
        }
        headers.push((name, value.clone()));
    }
    if req.body.as_ref().is_some_and(|b| b.len() > MAX_REQUEST_BYTES) {
        return Err("ai-proxy-request-too-large".into());
    }
    let secret = match req.key_slot.as_deref() {
        None | Some("") => None,
        Some(slot) => {
            let scheme = check_slot_host(slot, &url)?;
            get_key(store, slot)?.map(|key| (scheme, key))
        }
    };
    let timeout_ms = req
        .timeout_ms
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
    Ok(Prepared {
        url,
        method,
        headers,
        body: req.body.clone(),
        secret,
        timeout: Duration::from_millis(timeout_ms),
    })
}

fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && a.port_or_known_default() == b.port_or_known_default()
}

fn redact(text: String, secret: Option<&str>) -> String {
    match secret {
        Some(s) if s.len() >= 4 => text.replace(s, "[redacted]"),
        _ => text,
    }
}

fn map_error(err: &reqwest::Error) -> String {
    if err.is_timeout() {
        "ai-proxy-timeout".into()
    } else if err.is_connect() {
        "ai-proxy-connect-failed".into()
    } else {
        "ai-proxy-request-failed".into()
    }
}

/// Envía la solicitud preparada y lee la respuesta completa con tope de tamaño.
pub async fn execute(p: Prepared, max_response: usize) -> Result<AiHttpResponse, String> {
    ensure_crypto_provider();
    let policy = redirect::Policy::custom(|attempt| {
        let origin_ok = attempt.previous().first().is_some_and(|first| same_origin(first, attempt.url()));
        if origin_ok && attempt.previous().len() <= MAX_REDIRECTS {
            attempt.follow()
        } else {
            attempt.stop()
        }
    });
    let client = reqwest::Client::builder()
        .redirect(policy)
        .no_proxy()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(p.timeout)
        .build()
        .map_err(|_| "ai-proxy-request-failed".to_string())?;

    let mut builder = client.request(p.method, p.url);
    for (name, value) in &p.headers {
        builder = builder.header(name.as_str(), value.as_str());
    }
    if let Some((scheme, key)) = &p.secret {
        builder = match scheme {
            AuthScheme::Bearer => builder.bearer_auth(key),
            AuthScheme::GoogApiKey => builder.header("x-goog-api-key", key.as_str()),
            AuthScheme::XApiKey => builder.header("x-api-key", key.as_str()),
        };
    }
    if let Some(body) = p.body {
        builder = builder.body(body);
    }
    let secret = p.secret.as_ref().map(|(_, key)| key.as_str());

    let run = async {
        let mut resp = builder.send().await.map_err(|e| map_error(&e))?;
        if resp.status().is_redirection() {
            return Err("ai-proxy-redirect-blocked".to_string());
        }
        if resp.content_length().is_some_and(|len| len as usize > max_response) {
            return Err("ai-proxy-response-too-large".to_string());
        }
        let status = resp.status().as_u16();
        let mut bytes: Vec<u8> = Vec::new();
        while let Some(chunk) = resp.chunk().await.map_err(|e| map_error(&e))? {
            if bytes.len() + chunk.len() > max_response {
                return Err("ai-proxy-response-too-large".to_string());
            }
            bytes.extend_from_slice(&chunk);
        }
        let body = String::from_utf8_lossy(&bytes).into_owned();
        Ok(AiHttpResponse { status, body: redact(body, secret) })
    };
    // Tope adicional por si el servidor gotea bytes lentamente dentro del plazo del cliente.
    match tokio::time::timeout(p.timeout + Duration::from_secs(1), run).await {
        Ok(result) => result,
        Err(_) => Err("ai-proxy-timeout".into()),
    }
}

fn hosts_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(HOSTS_FILE))
        .map_err(|_| "ai-host-store-failed".to_string())
}

fn current_hosts(app: &AppHandle, state: &AiProxyState) -> Result<Vec<String>, String> {
    let mut cache = state.hosts.lock().map_err(|_| "ai-host-store-failed")?;
    if cache.is_none() {
        *cache = Some(ai_hosts::load_hosts(&hosts_path(app)?));
    }
    Ok(cache.clone().unwrap_or_default())
}

#[tauri::command]
pub async fn ai_http_request(
    app: AppHandle,
    state: State<'_, AiProxyState>,
    request: AiHttpRequest,
) -> Result<AiHttpResponse, String> {
    if !valid_request_id(&request.request_id) {
        return Err("ai-proxy-request-invalid".into());
    }
    let hosts = current_hosts(&app, &state)?;
    let prepared = prepare(&request, &hosts, &OsSecretStore)?;
    let (tx, rx) = oneshot::channel::<()>();
    state
        .inflight
        .lock()
        .map_err(|_| "ai-proxy-request-failed")?
        .insert(request.request_id.clone(), tx);
    let result = tokio::select! {
        r = execute(prepared, MAX_RESPONSE_BYTES) => r,
        _ = rx => Err("ai-proxy-cancelled".to_string()),
    };
    if let Ok(mut map) = state.inflight.lock() {
        map.remove(&request.request_id);
    }
    result
}

#[tauri::command]
pub fn ai_http_cancel(state: State<'_, AiProxyState>, request_id: String) {
    if let Ok(mut map) = state.inflight.lock() {
        if let Some(tx) = map.remove(&request_id) {
            let _ = tx.send(());
        }
    }
}

#[tauri::command]
pub fn ai_allowed_hosts_get(app: AppHandle, state: State<'_, AiProxyState>) -> Result<Vec<String>, String> {
    current_hosts(&app, &state)
}

/// Reemplaza la lista. Si agrega hosts nuevos, el usuario debe confirmarlos en un
/// diálogo nativo: un webview comprometido no puede ampliar la lista en silencio.
#[tauri::command]
pub async fn ai_allowed_hosts_set(
    app: AppHandle,
    state: State<'_, AiProxyState>,
    hosts: Vec<String>,
) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    let next = ai_hosts::normalize_list(&hosts)?;
    let current = current_hosts(&app, &state)?;
    let added: Vec<&String> = next.iter().filter(|h| !current.contains(h)).collect();
    if !added.is_empty() {
        let list = added.iter().map(|h| format!("• {h}")).collect::<Vec<_>>().join("\n");
        let confirmed = app
            .dialog()
            .message(format!(
                "¿Permitir que Kurra3D Studio envíe solicitudes de IA a estos servidores?\n\
                 Allow Kurra3D Studio to send AI requests to these servers?\n\n{list}"
            ))
            .title("Kurra3D Studio")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancel)
            .blocking_show();
        if !confirmed {
            return Err("ai-host-change-cancelled".into());
        }
    }
    ai_hosts::save_hosts(&hosts_path(&app)?, &next)?;
    *state.hosts.lock().map_err(|_| "ai-host-store-failed")? = Some(next.clone());
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::mpsc;
    use std::thread;

    struct OneKey(&'static str, &'static str);
    impl SecretStore for OneKey {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok((account == format!("provider:{}", self.0)).then(|| self.1.to_string()))
        }
        fn set(&self, _: &str, _: &str) -> Result<(), String> {
            Ok(())
        }
        fn delete(&self, _: &str) -> Result<(), String> {
            Ok(())
        }
    }

    /// Servidor HTTP mínimo: atiende una conexión por respuesta y devuelve cada petición recibida.
    fn serve(responses: Vec<Vec<u8>>, delay: Duration) -> (u16, mpsc::Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            for response in responses {
                let Ok((mut stream, _)) = listener.accept() else { return };
                let mut buf = Vec::new();
                let mut chunk = [0u8; 4096];
                while !buf.windows(4).any(|w| w == b"\r\n\r\n") {
                    match stream.read(&mut chunk) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => buf.extend_from_slice(&chunk[..n]),
                    }
                }
                let _ = tx.send(String::from_utf8_lossy(&buf).into_owned());
                thread::sleep(delay);
                let _ = stream.write_all(&response);
            }
        });
        (port, rx)
    }

    fn http(status: &str, extra: &str, body: &str) -> Vec<u8> {
        format!(
            "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
            body.len()
        )
        .into_bytes()
    }

    fn request(url: String, slot: Option<&str>) -> AiHttpRequest {
        AiHttpRequest {
            request_id: "r1".into(),
            url,
            method: Some("POST".into()),
            headers: HashMap::from([("content-type".to_string(), "application/json".to_string())]),
            body: Some("{}".into()),
            key_slot: slot.map(str::to_string),
            timeout_ms: Some(5_000),
        }
    }

    fn run<F: std::future::Future>(f: F) -> F::Output {
        tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap().block_on(f)
    }

    const NO_KEYS: OneKey = OneKey("none", "");

    #[test]
    fn rejects_auth_headers_methods_and_oversized_bodies_from_the_webview() {
        let allowed = ai_hosts::default_hosts();
        for header in ["authorization", "x-api-key", "x-goog-api-key", "cookie", "host"] {
            let mut req = request("https://api.openai.com/v1/x".into(), None);
            req.headers.insert(header.into(), "v".into());
            assert_eq!(prepare(&req, &allowed, &NO_KEYS).err().unwrap(), "ai-proxy-header-not-allowed");
        }
        let mut req = request("https://api.openai.com/v1/x".into(), None);
        req.method = Some("DELETE".into());
        assert!(prepare(&req, &allowed, &NO_KEYS).is_err());
        let mut req = request("https://api.openai.com/v1/x".into(), None);
        req.body = Some("x".repeat(MAX_REQUEST_BYTES + 1));
        assert_eq!(prepare(&req, &allowed, &NO_KEYS).err().unwrap(), "ai-proxy-request-too-large");
        let req = request("https://evil.example.com/v1".into(), None);
        assert_eq!(prepare(&req, &allowed, &NO_KEYS).err().unwrap(), "ai-proxy-host-not-allowed");
        let req = request("https://api.anthropic.com/v1".into(), Some("openai"));
        assert_eq!(prepare(&req, &allowed, &NO_KEYS).err().unwrap(), "ai-proxy-key-host-mismatch");
    }

    #[test]
    fn injects_the_key_server_side_and_redacts_echoes() {
        let secret = "test-secret-value-123";
        let (port, rx) = serve(vec![http("401 Unauthorized", "", &format!("bad key {secret}"))], Duration::ZERO);
        let req = request(format!("http://127.0.0.1:{port}/v1/chat"), Some("lmstudio"));
        let prepared = prepare(&req, &[], &OneKey("lmstudio", secret)).unwrap();
        let resp = run(execute(prepared, MAX_RESPONSE_BYTES)).unwrap();
        assert_eq!(resp.status, 401);
        assert_eq!(resp.body, "bad key [redacted]");
        let seen = rx.recv().unwrap().to_ascii_lowercase();
        assert!(seen.contains(&format!("authorization: bearer {secret}")));
    }

    #[test]
    fn follows_same_host_redirects_but_blocks_other_hosts() {
        let (port, _rx) = serve(
            vec![http("302 Found", "Location: /final\r\n", ""), http("200 OK", "", "ok")],
            Duration::ZERO,
        );
        let prepared = prepare(&request(format!("http://127.0.0.1:{port}/a"), None), &[], &NO_KEYS).unwrap();
        assert_eq!(run(execute(prepared, 1024)).unwrap().body, "ok");

        let (port, _rx) = serve(
            vec![http("302 Found", &format!("Location: http://localhost:{}/x\r\n", 9), "")],
            Duration::ZERO,
        );
        let prepared = prepare(&request(format!("http://127.0.0.1:{port}/a"), None), &[], &NO_KEYS).unwrap();
        assert_eq!(run(execute(prepared, 1024)).err().unwrap(), "ai-proxy-redirect-blocked");
    }

    #[test]
    fn enforces_response_size_and_time_limits() {
        let big = "x".repeat(4096);
        let (port, _rx) = serve(vec![http("200 OK", "", &big)], Duration::ZERO);
        let prepared = prepare(&request(format!("http://127.0.0.1:{port}/a"), None), &[], &NO_KEYS).unwrap();
        assert_eq!(run(execute(prepared, 1024)).err().unwrap(), "ai-proxy-response-too-large");

        let (port, _rx) = serve(vec![http("200 OK", "", "late")], Duration::from_millis(2_500));
        let mut req = request(format!("http://127.0.0.1:{port}/a"), None);
        req.timeout_ms = Some(1_000);
        let prepared = prepare(&req, &[], &NO_KEYS).unwrap();
        assert_eq!(run(execute(prepared, 1024)).err().unwrap(), "ai-proxy-timeout");
    }

    #[test]
    fn request_ids_are_restricted() {
        assert!(valid_request_id("ai_123-abc"));
        assert!(!valid_request_id(""));
        assert!(!valid_request_id("../x"));
        assert!(!valid_request_id(&"a".repeat(65)));
    }
}

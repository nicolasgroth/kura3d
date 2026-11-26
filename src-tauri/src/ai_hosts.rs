// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: AGPL-3.0-or-later
// Descripción: Política de destinos del proxy IA nativo. Lista de hosts permitidos
// (por defecto los oficiales; el usuario la edita en Ajustes y la confirma en un
// diálogo nativo), validación de URL (solo https, o http a loopback), vínculo de
// cada clave del llavero con los hosts a los que puede viajar y persistencia en
// el directorio de configuración de la aplicación.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use url::{Host, Url};

/// Hosts oficiales permitidos por defecto. `*.dominio` admite solo subdominios.
pub const DEFAULT_HOSTS: &[&str] = &[
    "generativelanguage.googleapis.com",
    "api.openai.com",
    "api.anthropic.com",
    "api.deepseek.com",
    "dashscope-intl.aliyuncs.com",
    "dashscope.aliyuncs.com",
    "dashscope-us.aliyuncs.com",
    "*.maas.aliyuncs.com",
    "openrouter.ai",
];

pub const MAX_HOSTS: usize = 64;
const MAX_HOST_LEN: usize = 253;

/// Cómo se adjunta la clave de cada ranura del llavero.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthScheme {
    Bearer,
    GoogApiKey,
    XApiKey,
}

/// A qué hosts puede viajar la clave de una ranura.
enum SlotHosts {
    Fixed(&'static [&'static str]),
    LoopbackOnly,
    AnyAllowed,
}

fn slot_policy(slot: &str) -> Result<(AuthScheme, SlotHosts), String> {
    use SlotHosts::*;
    Ok(match slot {
        "gemini" => (AuthScheme::GoogApiKey, Fixed(&["generativelanguage.googleapis.com"])),
        "openai" => (AuthScheme::Bearer, Fixed(&["api.openai.com"])),
        "anthropic" => (AuthScheme::XApiKey, Fixed(&["api.anthropic.com"])),
        "deepseek" => (AuthScheme::Bearer, Fixed(&["api.deepseek.com"])),
        "qwen" => (
            AuthScheme::Bearer,
            Fixed(&[
                "dashscope-intl.aliyuncs.com",
                "dashscope.aliyuncs.com",
                "dashscope-us.aliyuncs.com",
                "*.maas.aliyuncs.com",
            ]),
        ),
        "openrouter" => (AuthScheme::Bearer, Fixed(&["openrouter.ai"])),
        "ollama" | "lmstudio" => (AuthScheme::Bearer, LoopbackOnly),
        "custom" => (AuthScheme::Bearer, AnyAllowed),
        _ => return Err("ai-provider-not-allowed".into()),
    })
}

/// Normaliza una entrada de la lista: minúsculas, sin punto final, solo `[a-z0-9.-]`
/// y, opcionalmente, un prefijo `*.` para subdominios.
pub fn normalize_host(raw: &str) -> Result<String, String> {
    let host = raw.trim().trim_end_matches('.').to_ascii_lowercase();
    let (wildcard, name) = match host.strip_prefix("*.") {
        Some(rest) => (true, rest),
        None => (false, host.as_str()),
    };
    let valid_label = |label: &str| {
        !label.is_empty()
            && label.len() <= 63
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    };
    let labels: Vec<&str> = name.split('.').collect();
    // Un comodín exige al menos dominio + TLD para no abrir un TLD entero (`*.com`).
    let min_labels = if wildcard { 2 } else { 1 };
    if name.is_empty()
        || host.len() > MAX_HOST_LEN
        || labels.len() < min_labels
        || !labels.iter().all(|l| valid_label(l))
    {
        return Err("ai-host-invalid".into());
    }
    Ok(host)
}

/// Normaliza, quita duplicados y aplica el tope de entradas.
pub fn normalize_list(hosts: &[String]) -> Result<Vec<String>, String> {
    let mut out: Vec<String> = Vec::new();
    for raw in hosts {
        let host = normalize_host(raw)?;
        if !out.contains(&host) {
            out.push(host);
        }
    }
    if out.len() > MAX_HOSTS {
        return Err("ai-host-list-too-long".into());
    }
    Ok(out)
}

pub fn default_hosts() -> Vec<String> {
    DEFAULT_HOSTS.iter().map(|h| h.to_string()).collect()
}

fn host_matches(pattern: &str, host: &str) -> bool {
    match pattern.strip_prefix("*.") {
        Some(suffix) => host.len() > suffix.len() + 1 && host.ends_with(&format!(".{suffix}")),
        None => pattern == host,
    }
}

pub fn is_loopback(url: &Url) -> bool {
    match url.host() {
        Some(Host::Ipv4(ip)) => ip.octets() == [127, 0, 0, 1],
        Some(Host::Domain(d)) => d.eq_ignore_ascii_case("localhost"),
        _ => false,
    }
}

/// Valida la URL de destino: sin credenciales embebidas; `http` solo a loopback;
/// `https` a loopback o a un host de la lista permitida.
pub fn validate_target(raw: &str, allowed: &[String]) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "ai-proxy-url-invalid".to_string())?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err("ai-proxy-url-invalid".into());
    }
    let loopback = is_loopback(&url);
    match url.scheme() {
        "http" if loopback => Ok(url),
        "https" if loopback => Ok(url),
        "https" => {
            let host = match url.host() {
                Some(Host::Domain(d)) => d.to_ascii_lowercase(),
                Some(Host::Ipv4(ip)) => ip.to_string(),
                _ => return Err("ai-proxy-host-not-allowed".into()),
            };
            if allowed.iter().any(|p| host_matches(p, &host)) {
                Ok(url)
            } else {
                Err("ai-proxy-host-not-allowed".into())
            }
        }
        _ => Err("ai-proxy-url-invalid".into()),
    }
}

/// Comprueba que la clave de `slot` pueda viajar a `url` y devuelve cómo adjuntarla.
pub fn check_slot_host(slot: &str, url: &Url) -> Result<AuthScheme, String> {
    let (scheme, hosts) = slot_policy(slot)?;
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    let ok = match hosts {
        SlotHosts::Fixed(list) => url.scheme() == "https" && list.iter().any(|p| host_matches(p, &host)),
        SlotHosts::LoopbackOnly => is_loopback(url),
        // La URL ya pasó `validate_target`, así que está en la lista del usuario o es loopback.
        SlotHosts::AnyAllowed => true,
    };
    if ok {
        Ok(scheme)
    } else {
        Err("ai-proxy-key-host-mismatch".into())
    }
}

#[derive(Serialize, Deserialize)]
struct HostsFile {
    version: u32,
    hosts: Vec<String>,
}

/// Lee la lista persistida; si no existe o está dañada, devuelve la lista por defecto.
pub fn load_hosts(path: &Path) -> Vec<String> {
    fs::read(path)
        .ok()
        .filter(|bytes| bytes.len() <= 64 * 1024)
        .and_then(|bytes| serde_json::from_slice::<HostsFile>(&bytes).ok())
        .and_then(|file| normalize_list(&file.hosts).ok())
        .unwrap_or_else(default_hosts)
}

/// Guarda la lista de forma atómica (archivo temporal + renombrado).
pub fn save_hosts(path: &Path, hosts: &[String]) -> Result<(), String> {
    let dir = path.parent().ok_or("ai-host-store-failed")?;
    fs::create_dir_all(dir).map_err(|_| "ai-host-store-failed")?;
    let body = serde_json::to_vec_pretty(&HostsFile { version: 1, hosts: hosts.to_vec() })
        .map_err(|_| "ai-host-store-failed")?;
    let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|_| "ai-host-store-failed")?;
    tmp.write_all(&body).map_err(|_| "ai-host-store-failed")?;
    tmp.persist(path).map_err(|_| "ai-host-store-failed")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn list(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn https_requires_an_allowed_host_and_http_only_loopback() {
        let allowed = default_hosts();
        assert!(validate_target("https://api.openai.com/v1/chat/completions", &allowed).is_ok());
        assert!(validate_target("https://API.OpenAI.com/v1", &allowed).is_ok());
        assert!(validate_target("https://ws1.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1", &allowed).is_ok());
        assert!(validate_target("http://127.0.0.1:11434/api/chat", &allowed).is_ok());
        assert!(validate_target("http://localhost:1234/v1", &allowed).is_ok());
        for bad in [
            "http://api.openai.com/v1",
            "https://evil.example.com/v1",
            "https://api.openai.com.evil.com/v1",
            "https://user:pw@api.openai.com/v1",
            "https://api.openai.com@evil.com/",
            "http://localhost.evil.com/",
            "http://192.168.1.5:11434/",
            "http://[::1]:11434/",
            "ftp://localhost/",
            "file:///etc/passwd",
            "https://maas.aliyuncs.com/",
            "not a url",
        ] {
            assert!(validate_target(bad, &allowed).is_err(), "{bad}");
        }
    }

    #[test]
    fn user_list_controls_extra_hosts() {
        let allowed = list(&["my.proxy.example"]);
        assert!(validate_target("https://my.proxy.example/v1", &allowed).is_ok());
        assert!(validate_target("https://api.openai.com/v1", &allowed).is_err());
    }

    #[test]
    fn host_entries_are_normalized_and_validated() {
        assert_eq!(normalize_host(" API.Example.COM. ").unwrap(), "api.example.com");
        assert_eq!(normalize_host("*.maas.aliyuncs.com").unwrap(), "*.maas.aliyuncs.com");
        for bad in ["", "*.com", "a b.com", "https://x.com", "x.com/path", "-x.com", "x..com", "*", "x.com:443"] {
            assert!(normalize_host(bad).is_err(), "{bad}");
        }
        let many: Vec<String> = (0..=MAX_HOSTS).map(|i| format!("h{i}.example.com")).collect();
        assert!(normalize_list(&many).is_err());
        assert_eq!(normalize_list(&list(&["a.com", "A.com"])).unwrap(), list(&["a.com"]));
    }

    #[test]
    fn official_keys_only_travel_to_their_own_hosts() {
        let openai = Url::parse("https://api.openai.com/v1").unwrap();
        let evil = Url::parse("https://my.proxy.example/v1").unwrap();
        let local = Url::parse("http://127.0.0.1:1234/v1").unwrap();
        assert_eq!(check_slot_host("openai", &openai).unwrap(), AuthScheme::Bearer);
        assert!(check_slot_host("gemini", &openai).is_err());
        assert!(check_slot_host("openai", &evil).is_err());
        assert!(check_slot_host("anthropic", &local).is_err());
        assert!(check_slot_host("lmstudio", &evil).is_err());
        assert!(check_slot_host("lmstudio", &local).is_ok());
        assert!(check_slot_host("custom", &evil).is_ok());
        assert!(check_slot_host("../openai", &openai).is_err());
    }

    #[test]
    fn hosts_file_round_trips_and_falls_back_to_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("hosts.json");
        assert_eq!(load_hosts(&path), default_hosts());
        save_hosts(&path, &list(&["a.example.com"])).unwrap();
        assert_eq!(load_hosts(&path), list(&["a.example.com"]));
        fs::write(&path, b"{broken").unwrap();
        assert_eq!(load_hosts(&path), default_hosts());
    }
}

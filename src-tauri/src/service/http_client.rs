use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::time::Duration;

#[derive(Debug, Deserialize)]
pub struct NativeHttpRequest {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct NativeHttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

pub const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

#[tauri::command]
pub async fn native_http_request(req: NativeHttpRequest) -> Result<NativeHttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(req.timeout_ms.unwrap_or(15000)))
        .user_agent(DEFAULT_USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let method = match req.method.as_deref().unwrap_or("GET").to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut request_builder = client.request(method, &req.url);

    if let Some(headers) = req.headers {
        let mut header_map = HeaderMap::new();
        for (k, v) in headers {
            if let (Ok(name), Ok(val)) = (HeaderName::from_str(&k), HeaderValue::from_str(&v)) {
                header_map.insert(name, val);
            }
        }
        request_builder = request_builder.headers(header_map);
    }

    if let Some(body) = req.body {
        request_builder = request_builder.body(body);
    }

    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let status = response.status().as_u16();
    let status_text = response.status().canonical_reason().unwrap_or("").to_string();

    let mut resp_headers = HashMap::new();
    for (k, v) in response.headers() {
        if let Ok(str_val) = v.to_str() {
            resp_headers.insert(k.as_str().to_lowercase(), str_val.to_string());
        }
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(NativeHttpResponse {
        status,
        status_text,
        headers: resp_headers,
        body,
    })
}

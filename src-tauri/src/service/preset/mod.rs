use crate::service::config::get_storage_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

const PI_CATALOG_BASE_URL: &str = "https://pi.dev/api/models/providers";
const PI_USER_AGENT: &str = "Atrium-Pi-ModelProvider-Manager/1.0";
const REQUEST_TIMEOUT_SECS: u64 = 10;
const MAX_CONCURRENT_FETCHES: usize = 6;

use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct PresetMeta {
    #[serde(default)]
    version: String,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    provider_count: usize,
    #[serde(default)]
    model_count: usize,
    #[serde(default)]
    last_remote_check: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProviderPresetSummary {
    id: String,
    name: String,
    #[serde(rename = "defaultApi")]
    default_api: Option<String>,
    #[serde(rename = "modelCount")]
    model_count: usize,
}

#[derive(Debug, Serialize)]
pub struct UpdatePresetsResult {
    pub success: bool,
    pub message: String,
    pub provider_count: usize,
    pub model_count: usize,
    pub updated_providers: Vec<String>,
}

#[tauri::command]
pub fn get_preset_index() -> Result<serde_json::Value, String> {
    let dir = get_storage_dir()?;
    let path = dir.join("presets").join("index.json");
    if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(serde_json::json!([]))
    }
}

#[tauri::command]
pub fn get_provider_preset(provider_id: String) -> Result<serde_json::Value, String> {
    let dir = get_storage_dir()?;
    let path = dir.join("presets").join(format!("{}.json", provider_id));
    if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Err(format!("Preset for provider {} not found", provider_id))
    }
}

#[tauri::command]
pub fn get_preset_meta() -> Result<serde_json::Value, String> {
    let dir = get_storage_dir()?;
    let path = dir.join("presets-meta.json");
    if path.exists() {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let meta: PresetMeta = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({
            "version": meta.version,
            "provider_count": meta.provider_count,
            "model_count": meta.model_count,
            "updated_at": meta.updated_at,
            "last_remote_check": meta.last_remote_check,
        }))
    } else {
        Ok(serde_json::json!({
            "version": "unknown",
            "provider_count": 0,
            "model_count": 0
        }))
    }
}

#[tauri::command]
pub async fn update_presets_from_remote(force: bool) -> Result<UpdatePresetsResult, String> {
    let dir = get_storage_dir()?;
    let presets_dir = dir.join("presets");
    let meta_path = dir.join("presets-meta.json");
    
    // 确保 presets 目录存在
    fs::create_dir_all(&presets_dir).map_err(|e| e.to_string())?;

    // 读取现有的 meta 信息
    let mut meta: PresetMeta = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        PresetMeta::default()
    };

    // 检查是否需要更新（非强制模式下，4小时内不重复检查）
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    if !force {
        if let Some(last_check) = meta.last_remote_check {
            if now.saturating_sub(last_check) < 4 * 60 * 60 {
                return Ok(UpdatePresetsResult {
                    success: true,
                    message: "预设数据已是最新，无需更新".to_string(),
                    provider_count: meta.provider_count,
                    model_count: meta.model_count,
                    updated_providers: vec![],
                });
            }
        }
    }

    // 读取现有的 index.json 获取提供商列表
    let index_path = presets_dir.join("index.json");
    let providers: Vec<ProviderPresetSummary> = if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_else(|_| vec![])
    } else {
        // 如果没有本地 index，使用默认的主流提供商列表
        get_default_providers()
    };

    if providers.is_empty() {
        return Err("没有可更新的提供商列表".to_string());
    }

    // 创建 HTTP 客户端
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .user_agent(PI_USER_AGENT)
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut updated_providers = Vec::new();
    let mut total_models = 0;
    let mut new_index: Vec<ProviderPresetSummary> = Vec::new();

    // 并发拉取所有提供商（限制并发度），然后与本地基线合并
    // （与 Pi 的 mergeModels 语义一致：远端覆盖同 id，其余保留）
    let fetches = providers.clone().into_iter().map(|provider| {
        let client = client.clone();
        let pid = provider.id.clone();
        async move {
            let url = format!("{}/{}", PI_CATALOG_BASE_URL, pid);
            let r = fetch_provider_from_remote(&client, &url, &pid).await;
            (pid, r)
        }
    });
    let results: Vec<(String, Result<Vec<serde_json::Value>, String>)> =
        futures_util::stream::iter(fetches)
            .buffer_unordered(MAX_CONCURRENT_FETCHES)
            .collect()
            .await;
    let results: std::collections::HashMap<_, _> = results.into_iter().collect();

    for provider in providers.iter() {
        let provider_file = presets_dir.join(format!("{}.json", provider.id));

        // 读取本地基线（可能不存在）
        let local: serde_json::Value = if provider_file.exists() {
            fs::read_to_string(&provider_file)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
                .unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let fetched = results
            .get(&provider.id)
            .cloned()
            .unwrap_or_else(|| Err("未执行请求".to_string()));

        match fetched {
            Ok(remote_models) => {
                let merged = merge_provider_preset(&provider.id, &provider.name, &local, remote_models);
                fs::write(&provider_file, serde_json::to_string_pretty(&merged).unwrap())
                    .map_err(|e| format!("保存提供商 {} 失败: {}", provider.id, e))?;

                let model_count = merged
                    .get("models")
                    .and_then(|m| m.as_array())
                    .map(|a| a.len())
                    .unwrap_or(0);
                total_models += model_count;
                updated_providers.push(provider.id.clone());

                new_index.push(ProviderPresetSummary {
                    id: provider.id.clone(),
                    name: merged
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(&provider.name)
                        .to_string(),
                    default_api: merged
                        .get("defaultApi")
                        .and_then(|a| a.as_str())
                        .map(|s| s.to_string()),
                    model_count,
                });
            }
            Err(e) => {
                // 远程获取失败（含 404），保留本地数据
                eprintln!("获取提供商 {} 失败: {}", provider.id, e);
                let local_count = local
                    .get("models")
                    .and_then(|m| m.as_array())
                    .map(|a| a.len())
                    .unwrap_or(provider.model_count);
                total_models += local_count;
                let mut kept = provider.clone();
                kept.model_count = local_count;
                new_index.push(kept);
            }
        }
    }

    if updated_providers.is_empty() {
        return Err("未能从 Pi 远端同步任何提供商，已保留本地数据，请检查网络后重试".into());
    }

    // 保存更新后的 index.json
    fs::write(
        &index_path,
        serde_json::to_string_pretty(&new_index).unwrap(),
    )
    .map_err(|e| format!("保存索引文件失败: {}", e))?;

    // 更新 meta 信息
    meta.updated_at = chrono::Utc::now().to_rfc3339();
    meta.provider_count = new_index.len();
    meta.model_count = total_models;
    // 部分失败时不设置冷却窗口，允许重试。
    meta.last_remote_check = if updated_providers.len() == new_index.len() { Some(now) } else { None };
    meta.version = format!("remote-{}", now);

    fs::write(&meta_path, serde_json::to_string_pretty(&meta).unwrap())
        .map_err(|e| format!("保存元数据失败: {}", e))?;

    let failed = new_index.len() - updated_providers.len();
    let message = if failed == 0 {
        format!("成功从 Pi 远端同步 {} 个提供商的模型预设", updated_providers.len())
    } else {
        format!(
            "已从 Pi 远端同步 {} 个提供商，{} 个提供商未在远端目录中或请求失败（已保留本地数据）",
            updated_providers.len(),
            failed
        )
    };

    Ok(UpdatePresetsResult {
        success: !updated_providers.is_empty(),
        message,
        provider_count: new_index.len(),
        model_count: total_models,
        updated_providers,
    })
}

async fn fetch_provider_from_remote(
    client: &reqwest::Client,
    url: &str,
    provider_id: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let response = client
        .get(url)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if response.status() == 404 || response.status() == 501 {
        return Err(format!("提供商 {} 在远端目录中不存在", provider_id));
    }

    if !response.status().is_success() {
        return Err(format!("请求失败，状态码: {}", response.status()));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    // 与 Pi 的 parseCatalog 一致：支持 数组 / {models:[...]} / {modelId: model} 三种形态
    let entries: Vec<serde_json::Value> = if let Some(arr) = body.as_array() {
        arr.clone()
    } else if let Some(arr) = body.get("models").and_then(|m| m.as_array()) {
        arr.clone()
    } else if let Some(obj) = body.as_object() {
        obj.values().cloned().collect()
    } else {
        return Err(format!("提供商 {} 的远端目录格式无效", provider_id));
    };

    let models: Vec<serde_json::Value> = entries
        .into_iter()
        .filter(|m| m.is_object() && m.get("id").and_then(|v| v.as_str()).is_some())
        .map(|mut m| {
            if let Some(obj) = m.as_object_mut() {
                obj.insert("provider".into(), serde_json::json!(provider_id));
                let id = obj.get("id").cloned().unwrap_or_default();
                obj.entry("appliedPreset").or_insert(id);
            }
            m
        })
        .collect();

    if models.is_empty() {
        return Err(format!("提供商 {} 的远端目录没有有效模型", provider_id));
    }
    Ok(models)
}

/// 将远端模型叠加到本地基线：同 id 覆盖，其余本地模型保留。
/// 提供商级字段优先沿用本地，缺失时从首个模型推导。
fn merge_provider_preset(
    provider_id: &str,
    fallback_name: &str,
    local: &serde_json::Value,
    remote_models: Vec<serde_json::Value>,
) -> serde_json::Value {
    let mut merged: Vec<serde_json::Value> = local
        .get("models")
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    for rm in remote_models {
        let rid = rm.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
        if let Some(idx) = merged
            .iter()
            .position(|lm| lm.get("id").and_then(|v| v.as_str()) == Some(rid.as_str()))
        {
            merged[idx] = rm;
        } else {
            merged.push(rm);
        }
    }

    let first = merged.first().cloned().unwrap_or(serde_json::json!({}));
    let pick = |key: &str| -> serde_json::Value {
        local
            .get(key)
            .filter(|v| !v.is_null())
            .cloned()
            .or_else(|| first.get(key).filter(|v| !v.is_null()).cloned())
            .unwrap_or(serde_json::Value::Null)
    };

    let name = local
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if fallback_name.is_empty() {
                format_provider_display_name(provider_id)
            } else {
                fallback_name.to_string()
            }
        });

    let mut default_api = pick("defaultApi");
    if default_api.is_null() {
        default_api = first.get("api").cloned().unwrap_or(serde_json::Value::Null);
    }

    serde_json::json!({
        "id": provider_id,
        "name": name,
        "baseUrl": pick("baseUrl"),
        "defaultApi": default_api,
        "compat": pick("compat"),
        "models": merged,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn remote_overlay_replaces_matching_models_and_preserves_baseline() {
        let local = json!({"name":"Custom name", "baseUrl":"https://example.com", "models":[
            {"id":"a", "contextWindow":100}, {"id":"b"}
        ]});
        let merged = merge_provider_preset("test", "Test", &local, vec![
            json!({"id":"a", "contextWindow":200, "api":"openai-responses"}),
            json!({"id":"c"})
        ]);
        assert_eq!(merged["models"].as_array().unwrap().len(), 3);
        assert_eq!(merged["models"][0]["contextWindow"], 200);
        assert_eq!(merged["name"], "Custom name");
        assert_eq!(merged["baseUrl"], "https://example.com");
        assert_eq!(merged["defaultApi"], "openai-responses");
    }

    #[test]
    fn generated_metadata_is_readable() {
        let meta: PresetMeta = serde_json::from_value(json!({
            "version":"test", "updatedAt":"2026-01-01", "providerCount":39, "modelCount":1300
        })).unwrap();
        assert_eq!(meta.provider_count, 39);
        assert_eq!(meta.model_count, 1300);
        assert_eq!(meta.last_remote_check, None);
    }
}

fn get_default_providers() -> Vec<ProviderPresetSummary> {
    vec![
        ProviderPresetSummary {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            default_api: Some("openai-responses".to_string()),
            model_count: 0,
        },
        ProviderPresetSummary {
            id: "anthropic".to_string(),
            name: "Anthropic".to_string(),
            default_api: Some("anthropic-messages".to_string()),
            model_count: 0,
        },
        ProviderPresetSummary {
            id: "google".to_string(),
            name: "Google Gemini".to_string(),
            default_api: Some("google-genai".to_string()),
            model_count: 0,
        },
        ProviderPresetSummary {
            id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            default_api: Some("openai-responses".to_string()),
            model_count: 0,
        },
        ProviderPresetSummary {
            id: "xai".to_string(),
            name: "xAI".to_string(),
            default_api: Some("openai-responses".to_string()),
            model_count: 0,
        },
        ProviderPresetSummary {
            id: "openrouter".to_string(),
            name: "OpenRouter".to_string(),
            default_api: Some("openai-responses".to_string()),
            model_count: 0,
        },
    ]
}

fn format_provider_display_name(id: &str) -> String {
    match id {
        "openai" => "OpenAI".to_string(),
        "anthropic" => "Anthropic".to_string(),
        "google" => "Google Gemini".to_string(),
        "google-vertex" => "Google Vertex AI".to_string(),
        "deepseek" => "DeepSeek".to_string(),
        "xai" => "xAI (Grok)".to_string(),
        "openrouter" => "OpenRouter".to_string(),
        "mistral" => "Mistral AI".to_string(),
        "groq" => "Groq".to_string(),
        "together" => "Together AI".to_string(),
        "fireworks" => "Fireworks AI".to_string(),
        "cerebras" => "Cerebras".to_string(),
        _ => {
            // 简单的首字母大写处理
            id.split('-')
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        }
    }
}

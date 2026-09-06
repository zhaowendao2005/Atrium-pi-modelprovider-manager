use rusqlite::{params, Connection};
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn init_sqlite_db(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT,
            api TEXT NOT NULL DEFAULT 'openai-completions',
            auth_header INTEGER NOT NULL DEFAULT 1,
            enabled INTEGER NOT NULL DEFAULT 1,
            auto_discover INTEGER NOT NULL DEFAULT 1,
            discovery_endpoint TEXT,
            oauth TEXT,
            env_json TEXT,
            headers_json TEXT,
            compat_json TEXT,
            model_overrides_json TEXT,
            applied_preset TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS models (
            id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            name TEXT,
            family TEXT,
            api TEXT,
            base_url TEXT,
            reasoning INTEGER DEFAULT 0,
            input_json TEXT,
            context_window INTEGER DEFAULT 128000,
            max_tokens INTEGER DEFAULT 16384,
            cost_json TEXT,
            thinking_level_map_json TEXT,
            sampling_params_json TEXT,
            headers_json TEXT,
            compat_json TEXT,
            applied_preset TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (provider_id, id),
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS official_presets (
            provider_id TEXT PRIMARY KEY,
            preset_name TEXT NOT NULL,
            base_url TEXT,
            default_api TEXT,
            compat_json TEXT,
            models_json TEXT,
            package_version TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            task_id TEXT NOT NULL,
            layout_mode TEXT NOT NULL DEFAULT 'single',
            concurrency_limit INTEGER NOT NULL DEFAULT 4,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_sessions (
            id TEXT PRIMARY KEY,
            group_id TEXT,
            task_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            model_id TEXT NOT NULL,
            provider_name TEXT,
            model_name TEXT,
            status TEXT NOT NULL DEFAULT 'idle',
            workspace_dir TEXT,
            messages_json TEXT,
            metrics_json TEXT,
            error TEXT,
            slot_index INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (group_id) REFERENCES test_groups(id) ON DELETE CASCADE
        );
        ",
    )?;
    Ok(())
}

#[tauri::command]
pub fn db_load_all(state: tauri::State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. 加载所有提供商
    let mut stmt = conn
        .prepare(
            "SELECT id, name, base_url, api_key, api, auth_header, enabled, auto_discover,
                    discovery_endpoint, oauth, env_json, headers_json, compat_json, model_overrides_json,
                    applied_preset, sort_order, created_at, updated_at
             FROM providers ORDER BY sort_order ASC, created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let provider_rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, Option<String>>(1)?,
                "baseUrl": row.get::<_, String>(2)?,
                "apiKey": row.get::<_, Option<String>>(3)?,
                "api": row.get::<_, Option<String>>(4)?,
                "authHeader": row.get::<_, i32>(5)? != 0,
                "enabled": row.get::<_, i32>(6)? != 0,
                "autoDiscover": row.get::<_, i32>(7)? != 0,
                "discoveryEndpoint": row.get::<_, Option<String>>(8)?,
                "oauth": row.get::<_, Option<String>>(9)?,
                "env": row.get::<_, Option<String>>(10)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "headers": row.get::<_, Option<String>>(11)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "compat": row.get::<_, Option<String>>(12)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "modelOverrides": row.get::<_, Option<String>>(13)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "appliedPreset": row.get::<_, Option<String>>(14)?,
                "sortOrder": row.get::<_, Option<i32>>(15)?,
                "createdAt": row.get::<_, Option<i64>>(16)?,
                "updatedAt": row.get::<_, Option<i64>>(17)?,
                "models": []
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut providers: Vec<serde_json::Value> = Vec::new();
    for p in provider_rows {
        if let Ok(val) = p {
            providers.push(val);
        }
    }

    // 2. 加载旗下所有模型
    let mut model_stmt = conn
        .prepare(
            "SELECT id, provider_id, name, family, api, base_url, reasoning, input_json,
                    context_window, max_tokens, cost_json, thinking_level_map_json,
                    sampling_params_json, headers_json, compat_json, applied_preset,
                    sort_order, created_at, updated_at
             FROM models",
        )
        .map_err(|e| e.to_string())?;

    let model_rows = model_stmt
        .query_map([], |row| {
            let pid: String = row.get(1)?;
            let model = serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, Option<String>>(2)?,
                "family": row.get::<_, Option<String>>(3)?,
                "api": row.get::<_, Option<String>>(4)?,
                "baseUrl": row.get::<_, Option<String>>(5)?,
                "reasoning": row.get::<_, i32>(6)? != 0,
                "input": row.get::<_, Option<String>>(7)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                    .unwrap_or_else(|| serde_json::json!(["text"])),
                "contextWindow": row.get::<_, Option<i64>>(8)?.unwrap_or(128000),
                "maxTokens": row.get::<_, Option<i64>>(9)?.unwrap_or(16384),
                "cost": row.get::<_, Option<String>>(10)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "thinkingLevelMap": row.get::<_, Option<String>>(11)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "samplingParams": row.get::<_, Option<String>>(12)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "headers": row.get::<_, Option<String>>(13)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "compat": row.get::<_, Option<String>>(14)?
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "appliedPreset": row.get::<_, Option<String>>(15)?,
                "sortOrder": row.get::<_, Option<i32>>(16)?,
                "createdAt": row.get::<_, Option<i64>>(17)?,
                "updatedAt": row.get::<_, Option<i64>>(18)?,
            });
            Ok((pid, model))
        })
        .map_err(|e| e.to_string())?;

    for res in model_rows {
        if let Ok((pid, model)) = res {
            if let Some(p) = providers.iter_mut().find(|item| item["id"] == pid) {
                if let Some(arr) = p["models"].as_array_mut() {
                    arr.push(model);
                }
            }
        }
    }

    Ok(serde_json::json!({ "providers": providers }))
}

#[tauri::command]
pub fn db_save_provider(state: tauri::State<DbState>, provider: serde_json::Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    let id = provider["id"].as_str().ok_or("Missing provider id")?;
    let name = provider["name"].as_str().unwrap_or(id);
    let base_url = provider["baseUrl"].as_str().unwrap_or("");
    let api_key = provider["apiKey"].as_str();
    let api = provider["api"].as_str().unwrap_or("openai-completions");
    let auth_header = if provider["authHeader"].as_bool().unwrap_or(true) { 1 } else { 0 };
    let enabled = if provider["enabled"].as_bool().unwrap_or(true) { 1 } else { 0 };
    let auto_discover = if provider["autoDiscover"].as_bool().unwrap_or(true) { 1 } else { 0 };
    let discovery_endpoint = provider["discoveryEndpoint"].as_str();
    let oauth = provider["oauth"].as_str();
    let env_json = provider["env"].as_object().map(|o| serde_json::to_string(o).unwrap());
    let headers_json = provider["headers"].as_object().map(|o| serde_json::to_string(o).unwrap());
    let compat_json = provider["compat"].as_object().map(|o| serde_json::to_string(o).unwrap());
    let model_overrides_json = provider.get("modelOverrides").map(|v| serde_json::to_string(v).unwrap());
    let applied_preset = provider["appliedPreset"].as_str();
    let now = chrono_now_ms();

    tx.execute(
        "INSERT INTO providers (id, name, base_url, api_key, api, auth_header, enabled, auto_discover,
                                discovery_endpoint, oauth, env_json, headers_json, compat_json, model_overrides_json,
                                applied_preset, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, COALESCE((SELECT created_at FROM providers WHERE id = ?1), ?16))
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            base_url = excluded.base_url,
            api_key = excluded.api_key,
            api = excluded.api,
            auth_header = excluded.auth_header,
            enabled = excluded.enabled,
            auto_discover = excluded.auto_discover,
            discovery_endpoint = excluded.discovery_endpoint,
            oauth = excluded.oauth,
            env_json = excluded.env_json,
            headers_json = excluded.headers_json,
            compat_json = excluded.compat_json,
            model_overrides_json = excluded.model_overrides_json,
            applied_preset = excluded.applied_preset,
            updated_at = excluded.updated_at",
        params![
            id, name, base_url, api_key, api, auth_header, enabled, auto_discover,
            discovery_endpoint, oauth, env_json, headers_json, compat_json, model_overrides_json,
            applied_preset, now
        ],
    ).map_err(|e| e.to_string())?;

    // 若请求体中携带 models 数组，则同步 Upsert 并级联清理已移除的模型
    if let Some(models) = provider["models"].as_array() {
        let mut model_ids: Vec<String> = Vec::new();
        for m in models {
            let mid = m["id"].as_str().unwrap_or("");
            if mid.is_empty() {
                continue;
            }
            model_ids.push(mid.to_string());
            save_single_model_internal(&tx, id, m, now)?;
        }

        if model_ids.is_empty() {
            tx.execute("DELETE FROM models WHERE provider_id = ?1", params![id])
                .map_err(|e| e.to_string())?;
        } else {
            let placeholders = (0..model_ids.len())
                .map(|i| format!("?{}", i + 2))
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                "DELETE FROM models WHERE provider_id = ?1 AND id NOT IN ({})",
                placeholders
            );
            let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();
            params_vec.push(&id);
            for mid in &model_ids {
                params_vec.push(mid);
            }
            tx.execute(&sql, rusqlite::params_from_iter(params_vec))
                .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_model(state: tauri::State<DbState>, provider_id: String, model: serde_json::Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let now = chrono_now_ms();
    save_single_model_internal(&tx, &provider_id, &model, now)?;
    tx.commit().map_err(|e| e.to_string())
}

pub fn save_single_model_internal(
    conn: &Connection,
    provider_id: &str,
    model: &serde_json::Value,
    now: i64,
) -> Result<(), String> {
    let mid = model["id"].as_str().ok_or("Missing model id")?;
    let name = model["name"].as_str();
    let family = model["family"].as_str();
    let api = model["api"].as_str();
    let base_url = model["baseUrl"].as_str();
    let reasoning = if model["reasoning"].as_bool().unwrap_or(false) { 1 } else { 0 };
    let input_json = model.get("input").map(|v| serde_json::to_string(v).unwrap());
    let context_window = model["contextWindow"].as_i64().unwrap_or(128000);
    let max_tokens = model["maxTokens"].as_i64().unwrap_or(16384);
    let cost_json = model.get("cost").map(|v| serde_json::to_string(v).unwrap());
    let thinking_level_map_json = model.get("thinkingLevelMap").map(|v| serde_json::to_string(v).unwrap());
    let sampling_params_json = model.get("samplingParams").map(|v| serde_json::to_string(v).unwrap());
    let headers_json = model.get("headers").map(|v| serde_json::to_string(v).unwrap());
    let compat_json = model.get("compat").map(|v| serde_json::to_string(v).unwrap());
    let applied_preset = model["appliedPreset"].as_str();
    let sort_order = model["sortOrder"].as_i64().unwrap_or(0);

    conn.execute(
        "INSERT INTO models (id, provider_id, name, family, api, base_url, reasoning,
                             input_json, context_window, max_tokens, cost_json,
                             thinking_level_map_json, sampling_params_json, headers_json,
                             compat_json, applied_preset, sort_order, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, COALESCE((SELECT created_at FROM models WHERE provider_id = ?2 AND id = ?1), ?18))
         ON CONFLICT(provider_id, id) DO UPDATE SET
            name = excluded.name,
            family = excluded.family,
            api = excluded.api,
            base_url = excluded.base_url,
            reasoning = excluded.reasoning,
            input_json = excluded.input_json,
            context_window = excluded.context_window,
            max_tokens = excluded.max_tokens,
            cost_json = excluded.cost_json,
            thinking_level_map_json = excluded.thinking_level_map_json,
            sampling_params_json = excluded.sampling_params_json,
            headers_json = excluded.headers_json,
            compat_json = excluded.compat_json,
            applied_preset = excluded.applied_preset,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at",
        params![
            mid, provider_id, name, family, api, base_url, reasoning,
            input_json, context_window, max_tokens, cost_json,
            thinking_level_map_json, sampling_params_json, headers_json,
            compat_json, applied_preset, sort_order, now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_delete_provider(state: tauri::State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM models WHERE provider_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM providers WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_model(state: tauri::State<DbState>, provider_id: String, model_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM models WHERE provider_id = ?1 AND id = ?2", params![provider_id, model_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn app_meta_load(state: tauri::State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM app_meta").map_err(|e| e.to_string())?;
    let mut result = serde_json::Map::new();
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        result.insert(key, serde_json::from_str(&value).unwrap_or(serde_json::Value::String(value)));
    }
    Ok(serde_json::Value::Object(result))
}

#[tauri::command]
pub fn app_meta_save(state: tauri::State<DbState>, settings: serde_json::Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let object = settings.as_object().ok_or("settings must be an object")?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for (key, value) in object { tx.execute("INSERT INTO app_meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![key, serde_json::to_string(value).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?; }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_health(state: tauri::State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let integrity: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"ok": integrity == "ok", "integrity": integrity}))
}

#[tauri::command]
pub fn db_export_json(state: tauri::State<DbState>) -> Result<String, String> {
    let data = db_load_all(state)?;
    let target = crate::service::config::get_storage_dir()?.join(format!("manager.export.{}.json", chrono_now_ms()));
    let mut exported = data;
    if let Some(providers) = exported.get_mut("providers").and_then(|value| value.as_array_mut()) {
        for provider in providers { if let Some(object) = provider.as_object_mut() { object.remove("apiKey"); } }
    }
    std::fs::write(&target, serde_json::to_vec_pretty(&exported).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_backup(state: tauri::State<DbState>) -> Result<String, String> {
    let _guard = state.conn.lock().map_err(|e| e.to_string())?;
    let source = crate::service::config::get_storage_dir()?.join("manager.db");
    let target = crate::service::config::get_storage_dir()?.join(format!("manager.backup.{}.db", chrono_now_ms()));
    std::fs::copy(&source, &target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub fn db_get_stats(state: tauri::State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let providers: i64 = conn.query_row("SELECT COUNT(*) FROM providers", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    let models: i64 = conn.query_row("SELECT COUNT(*) FROM models", [], |row| row.get(0)).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({"providers": providers, "models": models}))
}

#[tauri::command]
pub fn db_load_test_history(state: tauri::State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut group_stmt = conn
        .prepare(
            "SELECT id, name, task_id, layout_mode, concurrency_limit, created_at, updated_at
             FROM test_groups ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let group_rows = group_stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "taskId": row.get::<_, String>(2)?,
                "layoutMode": row.get::<_, String>(3)?,
                "concurrencyLimit": row.get::<_, i64>(4)?,
                "createdAt": row.get::<_, i64>(5)?,
                "updatedAt": row.get::<_, i64>(6)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut groups = Vec::new();
    for g in group_rows {
        if let Ok(group) = g {
            groups.push(group);
        }
    }

    let mut session_stmt = conn
        .prepare(
            "SELECT id, group_id, task_id, provider_id, model_id, provider_name, model_name,
                    status, workspace_dir, messages_json, metrics_json, error, slot_index,
                    created_at, updated_at
             FROM test_sessions ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let session_rows = session_stmt
        .query_map([], |row| {
            let messages_json: Option<String> = row.get(9)?;
            let metrics_json: Option<String> = row.get(10)?;
            let messages: serde_json::Value = messages_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::json!([]));
            let metrics: serde_json::Value = metrics_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(serde_json::json!({}));

            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "groupId": row.get::<_, Option<String>>(1)?,
                "taskId": row.get::<_, String>(2)?,
                "providerId": row.get::<_, String>(3)?,
                "modelId": row.get::<_, String>(4)?,
                "providerName": row.get::<_, Option<String>>(5)?,
                "modelName": row.get::<_, Option<String>>(6)?,
                "status": row.get::<_, String>(7)?,
                "workspaceDir": row.get::<_, Option<String>>(8)?,
                "messages": messages,
                "metrics": metrics,
                "error": row.get::<_, Option<String>>(11)?,
                "slotIndex": row.get::<_, Option<i64>>(12)?,
                "createdAt": row.get::<_, i64>(13)?,
                "updatedAt": row.get::<_, i64>(14)?,
            }))
        })
        .map_err(|e| e.to_string())?;

    let mut sessions = Vec::new();
    for s in session_rows {
        if let Ok(session) = s {
            sessions.push(session);
        }
    }

    Ok(serde_json::json!({
        "groups": groups,
        "sessions": sessions,
    }))
}

#[tauri::command]
pub fn db_save_test_group(state: tauri::State<DbState>, group: serde_json::Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = group.get("id").and_then(|v| v.as_str()).ok_or("Group id missing")?;
    let name = group.get("name").and_then(|v| v.as_str()).unwrap_or("未命名测试组");
    let task_id = group.get("taskId").and_then(|v| v.as_str()).unwrap_or("");
    let layout_mode = group.get("layoutMode").and_then(|v| v.as_str()).unwrap_or("single");
    let concurrency_limit = group.get("concurrencyLimit").and_then(|v| v.as_i64()).unwrap_or(4);
    let now = chrono_now_ms();
    let created_at = group.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(now);

    conn.execute(
        "INSERT INTO test_groups (id, name, task_id, layout_mode, concurrency_limit, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            task_id = excluded.task_id,
            layout_mode = excluded.layout_mode,
            concurrency_limit = excluded.concurrency_limit,
            updated_at = excluded.updated_at",
        params![id, name, task_id, layout_mode, concurrency_limit, created_at, now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_delete_test_group(state: tauri::State<DbState>, group_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM test_sessions WHERE group_id = ?1", params![group_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM test_groups WHERE id = ?1", params![group_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_save_test_session(state: tauri::State<DbState>, session: serde_json::Value) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = session.get("id").and_then(|v| v.as_str()).ok_or("Session id missing")?;
    let group_id = session.get("groupId").and_then(|v| v.as_str());
    let task_id = session.get("taskId").and_then(|v| v.as_str()).unwrap_or("");
    let provider_id = session.get("providerId").and_then(|v| v.as_str()).unwrap_or("");
    let model_id = session.get("modelId").and_then(|v| v.as_str()).unwrap_or("");
    let provider_name = session.get("providerName").and_then(|v| v.as_str());
    let model_name = session.get("modelName").and_then(|v| v.as_str());
    let status = session.get("status").and_then(|v| v.as_str()).unwrap_or("idle");
    let workspace_dir = session.get("workspaceDir").and_then(|v| v.as_str());
    let messages_json = session.get("messages").map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".into()));
    let metrics_json = session.get("metrics").map(|v| serde_json::to_string(v).unwrap_or_else(|_| "{}".into()));
    let error = session.get("error").and_then(|v| v.as_str());
    let slot_index = session.get("slotIndex").and_then(|v| v.as_i64()).unwrap_or(0);
    let now = chrono_now_ms();
    let created_at = session.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(now);

    conn.execute(
        "INSERT INTO test_sessions (
            id, group_id, task_id, provider_id, model_id, provider_name, model_name,
            status, workspace_dir, messages_json, metrics_json, error, slot_index,
            created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(id) DO UPDATE SET
            group_id = excluded.group_id,
            task_id = excluded.task_id,
            provider_id = excluded.provider_id,
            model_id = excluded.model_id,
            provider_name = excluded.provider_name,
            model_name = excluded.model_name,
            status = excluded.status,
            workspace_dir = excluded.workspace_dir,
            messages_json = excluded.messages_json,
            metrics_json = excluded.metrics_json,
            error = excluded.error,
            slot_index = excluded.slot_index,
            updated_at = excluded.updated_at",
        params![
            id, group_id, task_id, provider_id, model_id, provider_name, model_name,
            status, workspace_dir, messages_json, metrics_json, error, slot_index,
            created_at, now
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn db_delete_test_session(state: tauri::State<DbState>, session_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM test_sessions WHERE id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

use crate::service::config::get_storage_dir;
use std::fs;

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

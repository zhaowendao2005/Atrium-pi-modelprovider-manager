use dirs::home_dir;
use std::fs;
use std::path::PathBuf;

/// 资源目录：优先使用 Tauri 注入的资源路径，回退到 exe 同级目录。
pub fn get_resource_dir() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("PI_MODEL_MANAGER_RESOURCE_DIR") {
        return Ok(PathBuf::from(dir));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return Ok(dir.to_path_buf());
        }
    }
    Err("Cannot resolve resource directory".into())
}

pub fn is_development() -> bool {
    match std::env::var("PI_MODEL_MANAGER_ENV").as_deref() {
        Ok("development") => true,
        Ok("production") => false,
        _ => cfg!(debug_assertions),
    }
}

pub fn get_storage_dir() -> Result<PathBuf, String> {
    let home = home_dir().ok_or("Cannot resolve home directory")?;
    let legacy_root = home.join(".pi").join("pi-modelprovider-manager-data");
    let atrium_root = home.join(".pi").join("atrium-pi-modelprovider-manager-data");
    let root = if atrium_root.exists() || !legacy_root.exists() {
        atrium_root
    } else {
        legacy_root
    };
    let dir = if is_development() { root.join("dev-cache") } else { root };
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn db_get_path() -> Result<String, String> {
    Ok(get_storage_dir()?.join("manager.db").to_string_lossy().to_string())
}

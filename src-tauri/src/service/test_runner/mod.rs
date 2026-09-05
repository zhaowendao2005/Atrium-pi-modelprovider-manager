use chrono::Local;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use tauri::Emitter;

const GROK_CORE_MODULE: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../dist/adapters/grok-core.js"));

use crate::service::config::get_storage_dir;

// 全局活跃的 RPC 子进程与标准输入写入句柄
struct ActiveProcess {
    child: Child,
    stdin: ChildStdin,
}

static ACTIVE_PROCESS: Mutex<Option<ActiveProcess>> = Mutex::new(None);

/// 创建测试沙箱工作空间
#[tauri::command]
pub fn create_test_workspace(model_config: serde_json::Value) -> Result<String, String> {
    let storage_dir = get_storage_dir()?;
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let config_repr = serde_json::to_string(&model_config).unwrap_or_default();
    let hash = format!("{:x}", md5::compute(config_repr));
    let hash_short = &hash[..8];

    let workspace_dir = storage_dir
        .join("model-test-space")
        .join(format!("{}_{}", timestamp, hash_short));

    fs::create_dir_all(&workspace_dir).map_err(|e| e.to_string())?;

    let test_results_dir = workspace_dir.join("test_results");
    fs::create_dir_all(&test_results_dir).map_err(|e| e.to_string())?;

    // 生成技能提示词与工作规范
    let skills_prompt = generate_skills_prompt(&workspace_dir);
    fs::write(workspace_dir.join("skills.md"), &skills_prompt).map_err(|e| e.to_string())?;
    fs::write(workspace_dir.join("README.md"), &skills_prompt).map_err(|e| e.to_string())?;

    let instructions = format!(
        "工作目录：{}\n请严格遵守目录限制，严禁访问外部网络或逃逸沙箱目录。",
        workspace_dir.display()
    );
    fs::write(workspace_dir.join("workspace_instructions.md"), instructions)
        .map_err(|e| e.to_string())?;

    Ok(workspace_dir.to_string_lossy().to_string())
}

fn generate_skills_prompt(workspace_dir: &Path) -> String {
    let workspace_path = workspace_dir.to_string_lossy();
    format!(
        r#"# Pi Agent 测试工作空间规范（Skills Prompt）

## 目录限制（必须严格遵守）
- 此目录路径：`{workspace_path}`
- **所有操作必须在此目录内**：
  - 文件读写：`{workspace_path}/` 及子目录
  - 命令执行：只能执行 `cd`、`ls`、`cat`、`echo`、`mkdir`、`touch`、`cp`、`mv`、`rm`、`ping`、`curl`、`node`、`python`、`powershell` 等 **本地命令**
- **外部网络访问 100% 拦截**：
  - 禁止任何 `curl`、`wget`、`fetch`、`http`、`https`、`socket`、`dns`（除非目标是 `localhost` 或当前目录）
  - 禁止任何外部进程启动（除非是本地命令）
  - 禁止任何网络端口扫描或外部 IP 访问

## Agent 行为规范
- 你必须在 `{workspace_path}` 目录内完成一系列简单的站点可用性测试。
- 测试内容包括：
  1. 流式响应测试（实时输出内容）
  2. 工具调用测试（记录工具调用过程）
  3. 命令执行测试（本地命令执行并记录结果）
  4. 文件操作测试（读写当前目录文件）
  5. 速度测试（测量本地命令执行时间）
- 你必须**严格遵守**所有目录限制。
- 所有操作必须**在当前目录**完成，**不能离开**。
- 每次操作后必须**记录日志**到 `{workspace_path}/test_log.json`。

## 输出格式要求
- 所有回复必须**流式输出**（逐字输出）。
- 每遇到工具调用或命令执行，必须在回复中包含：
[TOOL_CALL] tool_name: arguments

- 所有本地命令执行结果必须以 `[COMMAND_RESULT]` 开头记录。
- 最终测试结果必须总结并写入 `{workspace_path}/test_summary.txt`。

## 日志记录
- 所有操作必须记录到 `{workspace_path}/test_log.json`（JSON 格式）。
- 格式示例：
```json
{{
  "timestamp": "2025-...",
  "type": "command" | "tool" | "file",
  "action": "...",
  "result": "...",
  "success": true
}}
```
请严格遵守以上所有规范。
"#,
        workspace_path = workspace_path
    )
}

/// 启动 Pi Agent RPC 模式并建立双工事件流
#[tauri::command]
pub fn start_pi_agent_rpc(
    app: tauri::AppHandle,
    workspace_dir: String,
    model_config: serde_json::Value,
    prompt: String,
) -> Result<(), String> {
    // 终止可能存在的旧进程
    abort_pi_agent_rpc()?;

    let ws = PathBuf::from(&workspace_dir);
    if !ws.exists() {
        return Err(format!("工作空间目录不存在: {}", workspace_dir));
    }

    // 保存当前 Prompt
    fs::write(ws.join("test_user_prompt.txt"), &prompt).map_err(|e| e.to_string())?;

    let model_id = model_config
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let provider_id = model_config
        .get("providerId")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let api_key = model_config
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let base_url = model_config
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let api_type = model_config
        .get("api")
        .and_then(|v| v.as_str())
        .unwrap_or("openai-completions");

    // 1. 创建沙箱专属配置与会话目录 (彻底切断与宿主 ~/.pi/agent 的任何关联)
    let sandbox_agent_dir = ws.join(".pi-sandbox");
    let _ = fs::create_dir_all(&sandbox_agent_dir);
    let sandbox_sessions_dir = sandbox_agent_dir.join("sessions");
    let _ = fs::create_dir_all(&sandbox_sessions_dir);

    // 2. 在沙箱工作区生成单实例微型动态注册脚本 (官方标准 Extension API: pi.registerProvider)
    let mut ext_path_str = String::new();
    if !provider_id.is_empty() {
        let mut models_arr = Vec::new();
        if let Some(list) = model_config.get("models").and_then(|v| v.as_array()) {
            for m in list {
                models_arr.push(m.clone());
            }
        }
        if models_arr.is_empty() && !model_id.is_empty() && model_id != "default" {
            models_arr.push(serde_json::json!({
                "id": model_id,
                "name": model_id,
                "reasoning": true
            }));
        }

        let ext_file = ws.join("sandbox_provider.mjs");
        let core_file = ws.join("grok-core.mjs");
        fs::write(&core_file, GROK_CORE_MODULE).map_err(|e| e.to_string())?;
        let adapter_enabled = model_config.get("adapterId").and_then(|v| v.as_str()) == Some("grok-responses-harness");
        let ext_code = format!(
            r#"import {{ sanitizeGrokPayload }} from './grok-core.mjs';
export default function(pi) {{
  pi.registerProvider({provider_id:?}, {{
    name: {provider_id:?},
    baseUrl: {base_url:?},
    apiKey: {api_key:?},
    api: {api_type:?},
    models: {models_json}
  }});
  if ({adapter_enabled}) {{
    pi.on('before_provider_request', (event) => {{
      if (event.payload && typeof event.payload === 'object') sanitizeGrokPayload(event.payload, {model_id:?});
    }});
    pi.on('before_provider_headers', (event, ctx) => {{
      const sid = ctx.sessionManager.getSessionId();
      if (sid) event.headers['x-grok-conv-id'] = sid;
    }});
  }}
}}
"#,
            provider_id = provider_id,
            base_url = base_url,
            api_key = api_key,
            api_type = api_type,
            model_id = model_id,
            adapter_enabled = adapter_enabled,
            models_json = serde_json::to_string(&models_arr).unwrap_or_else(|_| "[]".into())
        );
        fs::write(&ext_file, ext_code).map_err(|e| e.to_string())?;
        ext_path_str = ext_file.to_string_lossy().to_string();
    }

    // Windows 平台调用 cmd.exe /C pi --mode rpc
    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("cmd");
    #[cfg(target_os = "windows")]
    {
        cmd.arg("/C").arg("pi");
    }

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("pi");

    // 3. 注入完全物理隔离的沙箱环境变量
    cmd.env("PI_CODING_AGENT_DIR", &sandbox_agent_dir);

    // 4. 组装纯净命令行参数
    cmd.arg("--mode").arg("rpc");
    cmd.arg("--no-extensions"); // 彻底禁用宿主生产环境全部扩展发现
    if !ext_path_str.is_empty() {
        cmd.arg("-e").arg(&ext_path_str); // 仅显式加载沙箱微型注册脚本
    }
    cmd.arg("--no-skills"); // 禁用宿主全局 skills
    cmd.arg("--no-context-files"); // 禁用宿主 AGENTS.md / CLAUDE.md
    cmd.arg("--session-dir").arg(sandbox_sessions_dir.to_string_lossy().to_string());

    if !provider_id.is_empty() {
        cmd.arg("--provider").arg(provider_id);
    }
    if !model_id.is_empty() && model_id != "default" {
        cmd.arg("--model").arg(model_id);
    }

    // 环境变量与 API Key 注入
    if !api_key.is_empty() {
        let env_key = format!("{}_API_KEY", provider_id.to_uppercase().replace('-', "_"));
        cmd.env(&env_key, api_key);
        cmd.env("OPENAI_API_KEY", api_key); // 兼容大多数通用中转
    }
    if !base_url.is_empty() {
        let env_base = format!("{}_BASE_URL", provider_id.to_uppercase().replace('-', "_"));
        cmd.env(&env_base, base_url);
    }

    cmd.current_dir(&ws);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    eprintln!(
        "[test_runner] 🚀 启动 Agent: pi --mode rpc (Provider: '{}', Model: '{}', hasKey: {}) in {}",
        provider_id,
        model_id,
        !api_key.is_empty(),
        ws.display()
    );

    let log_file_path = ws.join("test_runner.log");
    let init_log = format!(
        "[{}] 启动 Pi Agent RPC 测试\n- 目录: {}\n- Provider: {}\n- Model: {}\n\n",
        Local::now().format("%Y-%m-%d %H:%M:%S"),
        ws.display(),
        provider_id,
        model_id
    );
    let _ = fs::write(&log_file_path, &init_log);

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!("启动 pi --mode rpc 失败: {}", e);
            eprintln!("[test_runner ERROR] {}", err_msg);
            let _ = fs::write(
                ws.join("test_runner.log"),
                format!("{}❌ {}", init_log, err_msg),
            );
            return Err(err_msg);
        }
    };

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "无法获取子进程 stdin 管道".to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法获取子进程 stdout 管道".to_string())?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法获取子进程 stderr 管道".to_string())?;

    // 发送初始 prompt 指令
    let rpc_req = serde_json::json!({
        "id": format!("req-{}", Local::now().timestamp_millis()),
        "type": "prompt",
        "message": prompt,
    });
    let mut req_str = serde_json::to_string(&rpc_req).map_err(|e| e.to_string())?;
    req_str.push('\n');

    stdin
        .write_all(req_str.as_bytes())
        .map_err(|e| {
            let err_msg = format!("向 RPC 管道写入 prompt 失败: {}", e);
            eprintln!("[test_runner ERROR] {}", err_msg);
            err_msg
        })?;
    stdin.flush().map_err(|e| e.to_string())?;

    // 保存进程句柄
    {
        let mut lock = ACTIVE_PROCESS.lock().unwrap();
        *lock = Some(ActiveProcess { child, stdin });
    }

    // 后台线程异步监听 stdout (JSON Lines)
    let app_handle = app.clone();
    let ws_stdout = ws.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let log_path = ws_stdout.join("test_runner.log");
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim();
                if !trimmed.is_empty() {
                    // 终端与日志关键过滤爆出，避免海量 text_delta 刷屏
                    if trimmed.contains("\"success\":false") || trimmed.contains("\"error\"") {
                        eprintln!("[test_runner STDOUT ERROR] {}", trimmed);
                        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                            let _ = writeln!(f, "[ERROR] {}", trimmed);
                        }
                    } else if trimmed.contains("\"type\":\"agent_start\"")
                        || trimmed.contains("\"type\":\"agent_settled\"")
                        || trimmed.contains("\"type\":\"tool_execution_start\"")
                        || trimmed.contains("\"type\":\"tool_execution_end\"")
                    {
                        eprintln!("[test_runner STDOUT EVENT] {}", trimmed);
                        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                            let _ = writeln!(f, "[EVENT] {}", trimmed);
                        }
                    }
                    let _ = app_handle.emit("pi-rpc-event", trimmed.to_string());
                }
            }
        }
    });

    // 后台线程异步监听 stderr
    let app_stderr = app.clone();
    let ws_stderr = ws.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let log_path = ws_stderr.join("test_runner.log");
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim();
                if !trimmed.is_empty() {
                    eprintln!("[test_runner STDERR] {}", trimmed);
                    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                        let _ = writeln!(f, "[STDERR] {}", trimmed);
                    }
                    let event_type = if trimmed.contains("Failed to load extension") || trimmed.contains("Unknown provider") || trimmed.contains("Error:") {
                        "runner_error"
                    } else {
                        "stderr_log"
                    };
                    let err_event = serde_json::json!({
                        "type": event_type,
                        "text": trimmed,
                    });
                    let _ = app_stderr.emit("pi-rpc-event", err_event.to_string());
                }
            }
        }
    });

    Ok(())
}

/// 终止当前运行中的 Pi Agent RPC 操作
#[tauri::command]
pub fn abort_pi_agent_rpc() -> Result<(), String> {
    let mut lock = ACTIVE_PROCESS.lock().unwrap();
    if let Some(mut proc) = lock.take() {
        // 先发送优雅中断
        let abort_cmd = "{\"type\": \"abort\"}\n";
        let _ = proc.stdin.write_all(abort_cmd.as_bytes());
        let _ = proc.stdin.flush();

        // 稍作等待后强制关闭
        thread::sleep(std::time::Duration::from_millis(150));
        let _ = proc.child.kill();
    }
    Ok(())
}

/// 在 Windows 资源管理器中打开指定工作空间
#[tauri::command]
pub fn open_workspace_in_explorer(workspace_dir: String) -> Result<(), String> {
    let path = PathBuf::from(&workspace_dir);
    if !path.exists() {
        return Err("指定的目录不存在".into());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

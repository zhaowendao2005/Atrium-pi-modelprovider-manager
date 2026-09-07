use chrono::Local;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{LazyLock, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

const GROK_CORE_MODULE: &str = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../dist/adapters/grok-core.js"));

use crate::service::config::get_storage_dir;
use task_factory::{copy_task_to_workspace, list_test_tasks, TestTaskTemplate};

pub mod task_factory;

// 全局活跃的 RPC 子进程与标准输入写入句柄 (按 sessionId 索引)
struct ActiveProcess {
    child: Child,
    stdin: ChildStdin,
}

static ACTIVE_PROCESSES: LazyLock<Mutex<HashMap<String, ActiveProcess>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// 优雅终止 RPC 子进程：可选先发送 abort，随后关闭 stdin 触发 pi 自行退出，
/// 超时后兜底强杀，避免残留僵尸进程与控制台窗口。
fn graceful_terminate(mut proc: ActiveProcess, send_abort: bool) {
    if send_abort {
        let _ = proc.stdin.write_all(b"{\"type\": \"abort\"}\n");
        let _ = proc.stdin.flush();
    }
    // 关闭 stdin 管道 => pi --mode rpc 收到 EOF 后执行 shutdown() 并 exit(0)
    drop(proc.stdin);

    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match proc.child.try_wait() {
            Ok(Some(status)) => {
                eprintln!("[test_runner] RPC 进程已优雅退出: {:?}", status);
                break;
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = proc.child.kill();
                    let _ = proc.child.wait();
                    eprintln!("[test_runner] RPC 进程超时未退出，已强制终止");
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    }
}

/// 任务完成后由 stdout 监听线程触发：从活跃表移除并优雅收尾。
fn reap_session_process(session_id: &str) {
    let proc = {
        let mut lock = ACTIVE_PROCESSES.lock().unwrap();
        lock.remove(session_id)
    };
    if let Some(proc) = proc {
        eprintln!(
            "[test_runner] [Session: {}] 任务完成，正在优雅关闭 RPC 进程",
            session_id
        );
        graceful_terminate(proc, false);
    }
}

/// 创建测试沙箱工作空间
#[tauri::command]
pub fn create_test_workspace(
    model_config: serde_json::Value,
    task_id: Option<String>,
) -> Result<String, String> {
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

    // 如果有 task_id，使用任务工厂复制任务模板
    if let Some(task_id) = task_id {
        copy_task_to_workspace(&task_id, &workspace_dir)?;
    }

    // 所有沙箱都生成通用安全规范（任务提示词会引用 skills.md / workspace_instructions.md）
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

/// 列出所有可用的测试任务模板
#[tauri::command]
pub fn get_test_tasks() -> Result<Vec<TestTaskTemplate>, String> {
    Ok(list_test_tasks())
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

/// 启动指定 Session 的 Pi Agent RPC 模式并建立双工事件流
#[tauri::command]
pub fn start_session_rpc(
    app: tauri::AppHandle,
    session_id: String,
    workspace_dir: String,
    model_config: serde_json::Value,
    prompt: String,
) -> Result<(), String> {
    // 终止该 session 可能已存在的旧进程
    abort_session_rpc(Some(session_id.clone()))?;

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

    // Windows 平台调用 cmd.exe /C pi --mode rpc，并用 CREATE_NO_WINDOW 隐藏控制台窗口
    #[cfg(target_os = "windows")]
    let mut cmd = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut c = Command::new("cmd");
        c.arg("/C").arg("pi");
        c.creation_flags(CREATE_NO_WINDOW);
        c
    };

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
        "[test_runner] 🚀 [Session: {}] 启动 Agent: pi --mode rpc (Provider: '{}', Model: '{}', hasKey: {}) in {}",
        session_id,
        provider_id,
        model_id,
        !api_key.is_empty(),
        ws.display()
    );

    let log_file_path = ws.join("test_runner.log");
    let init_log = format!(
        "[{}] 启动 Pi Agent RPC 测试 [Session: {}]\n- 目录: {}\n- Provider: {}\n- Model: {}\n\n",
        Local::now().format("%Y-%m-%d %H:%M:%S"),
        session_id,
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
        let mut lock = ACTIVE_PROCESSES.lock().unwrap();
        lock.insert(session_id.clone(), ActiveProcess { child, stdin });
    }

    // 后台线程异步监听 stdout (JSON Lines)
    let app_handle = app.clone();
    let ws_stdout = ws.clone();
    let sid_stdout = session_id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let log_path = ws_stdout.join("test_runner.log");
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim();
                if !trimmed.is_empty() {
                    // 终端与日志关键过滤爆出，避免海量 text_delta 刷屏
                    if trimmed.contains("\"success\":false") || trimmed.contains("\"error\"") {
                        eprintln!("[test_runner STDOUT ERROR] [{}] {}", sid_stdout, trimmed);
                        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                            let _ = writeln!(f, "[ERROR] {}", trimmed);
                        }
                    } else if trimmed.contains("\"type\":\"agent_start\"")
                        || trimmed.contains("\"type\":\"agent_settled\"")
                        || trimmed.contains("\"type\":\"tool_execution_start\"")
                        || trimmed.contains("\"type\":\"tool_execution_end\"")
                    {
                        eprintln!("[test_runner STDOUT EVENT] [{}] {}", sid_stdout, trimmed);
                        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
                            let _ = writeln!(f, "[EVENT] {}", trimmed);
                        }
                    }
                    let unified_payload = serde_json::json!({
                        "sessionId": &sid_stdout,
                        "raw": trimmed
                    });
                    let _ = app_handle.emit("pi-rpc-event", unified_payload.to_string());

                    // 检测到 agent_settled：本次任务全部完成，触发优雅收尾，
                    // 关闭 RPC 进程并回收，避免残留进程与控制台窗口。
                    if trimmed.contains("\"type\":\"agent_settled\"") {
                        let reap_sid = sid_stdout.clone();
                        thread::spawn(move || reap_session_process(&reap_sid));
                    }
                }
            }
        }
        // 子进程退出后 stdout 管道关闭，兜底清理活跃表，避免残留句柄
        let _ = ACTIVE_PROCESSES.lock().unwrap().remove(&sid_stdout);
    });

    // 后台线程异步监听 stderr
    let app_stderr = app.clone();
    let ws_stderr = ws.clone();
    let sid_stderr = session_id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let log_path = ws_stderr.join("test_runner.log");
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim();
                if !trimmed.is_empty() {
                    eprintln!("[test_runner STDERR] [{}] {}", sid_stderr, trimmed);
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
                    let err_str = err_event.to_string();
                    let unified_payload = serde_json::json!({
                        "sessionId": &sid_stderr,
                        "raw": err_str
                    });
                    let _ = app_stderr.emit("pi-rpc-event", unified_payload.to_string());
                }
            }
        }
    });

    Ok(())
}

/// 继续向运行中的指定 Session 写入新的 Prompt 消息
#[tauri::command]
pub fn continue_session_rpc(session_id: String, prompt: String) -> Result<(), String> {
    let mut lock = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(proc) = lock.get_mut(&session_id) {
        let rpc_req = serde_json::json!({
            "id": format!("req-{}", Local::now().timestamp_millis()),
            "type": "prompt",
            "message": prompt,
        });
        let mut req_str = serde_json::to_string(&rpc_req).map_err(|e| e.to_string())?;
        req_str.push('\n');

        proc.stdin.write_all(req_str.as_bytes()).map_err(|e| {
            format!("向 Session [{}] RPC 管道写入 prompt 失败: {}", session_id, e)
        })?;
        proc.stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("未找到 Session [{}] 对应的活跃进程", session_id))
    }
}

/// 终止指定的 Session，或如果不提供 session_id 则终止全部 Session
#[tauri::command]
pub fn abort_session_rpc(session_id: Option<String>) -> Result<(), String> {
    let procs: Vec<ActiveProcess> = {
        let mut lock = ACTIVE_PROCESSES.lock().unwrap();
        if let Some(sid) = session_id {
            lock.remove(&sid).into_iter().collect()
        } else {
            let keys: Vec<String> = lock.keys().cloned().collect();
            keys.into_iter().filter_map(|k| lock.remove(&k)).collect()
        }
    };

    // 在锁外执行可能耗时的终止(等待退出)，避免阻塞其它会话的写入与回收
    for proc in procs {
        graceful_terminate(proc, true);
    }
    Ok(())
}

/// 启动 Pi Agent RPC 模式（兼容旧接口）
#[tauri::command]
pub fn start_pi_agent_rpc(
    app: tauri::AppHandle,
    workspace_dir: String,
    model_config: serde_json::Value,
    prompt: String,
) -> Result<(), String> {
    start_session_rpc(app, "default".to_string(), workspace_dir, model_config, prompt)
}

/// 终止当前运行中的 Pi Agent RPC 操作（兼容旧接口）
#[tauri::command]
pub fn abort_pi_agent_rpc() -> Result<(), String> {
    abort_session_rpc(None)
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

use include_dir::{include_dir, Dir, File};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

static TEST_TASKS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/templates/test_tasks");

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub order: u32,
    #[serde(default, alias = "allow_net", alias = "allowNet")]
    pub allow_net: bool,
    #[serde(default, alias = "expected_outputs", alias = "expectedOutputs")]
    pub expected_outputs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TestTaskTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub order: u32,
    #[serde(default)]
    pub allow_net: bool,
    #[serde(default)]
    pub expected_outputs: Vec<String>,
    pub user_prompt: String,
    pub system_prompt: Option<String>,
    pub plan: Option<String>,
    pub docs: Vec<DocFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocFile {
    pub filename: String,
    pub content: String,
}

/// 列出所有可用的测试任务模板。
/// 开发态优先读磁盘目录，方便改模板立刻生效；打包后回退到嵌入资源。
pub fn list_test_tasks() -> Vec<TestTaskTemplate> {
    if let Some(root) = disk_templates_root() {
        let from_disk = list_test_tasks_from_disk(&root);
        if !from_disk.is_empty() {
            return from_disk;
        }
    }
    list_test_tasks_from_embedded()
}

/// 获取指定任务的完整模板
pub fn get_task_template(task_id: &str) -> Option<TestTaskTemplate> {
    list_test_tasks().into_iter().find(|t| t.id == task_id)
}

/// 将任务模板复制到沙箱工作目录
pub fn copy_task_to_workspace(task_id: &str, workspace_dir: &Path) -> Result<(), String> {
    let task = get_task_template(task_id).ok_or_else(|| format!("Task not found: {}", task_id))?;

    // 模板输入只读，统一放在 task/；Agent 产物与日志不得写入模板区。
    let task_dir = workspace_dir.join("task");
    fs::create_dir_all(&task_dir).map_err(|e| e.to_string())?;
    fs::write(
        task_dir.join("manifest.json"),
        serde_json::to_string_pretty(&TaskManifest {
            id: task.id.clone(),
            name: task.name.clone(),
            description: task.description.clone(),
            category: task.category.clone(),
            order: task.order,
            allow_net: task.allow_net,
            expected_outputs: task.expected_outputs.clone(),
        }).map_err(|e| e.to_string())?,
    ).map_err(|e| e.to_string())?;
    fs::write(task_dir.join("prompt.md"), &task.user_prompt).map_err(|e| e.to_string())?;

    if let Some(system_prompt) = &task.system_prompt {
        fs::write(task_dir.join("system.md"), system_prompt).map_err(|e| e.to_string())?;
    }

    if let Some(plan) = &task.plan {
        fs::write(task_dir.join("plan.md"), plan).map_err(|e| e.to_string())?;
    }

    if !task.docs.is_empty() {
        let docs_dir = task_dir.join("docs");
        fs::create_dir_all(&docs_dir).map_err(|e| e.to_string())?;
        for doc in &task.docs {
            fs::write(docs_dir.join(&doc.filename), &doc.content).map_err(|e| e.to_string())?;
        }
    }

    fs::create_dir_all(workspace_dir.join("output")).map_err(|e| e.to_string())?;
    fs::create_dir_all(workspace_dir.join("logs")).map_err(|e| e.to_string())?;
    fs::create_dir_all(workspace_dir.join("test_results")).map_err(|e| e.to_string())?;

    // 让 Runner 和 Agent 使用同一份明确的执行说明。
    let execution_prompt = format!(
        "你正在执行任务：{}（{}）。\n\n必须先阅读 task/prompt.md{}。\n\n所有生成的代码必须放入 output/；操作日志写入 logs/ 或 test_log.json；最终报告写入 test_summary.txt。\n期望产出：{}",
        task.name,
        task.id,
        if task.plan.is_some() { " 和 task/plan.md" } else { "" },
        if task.expected_outputs.is_empty() { "无".to_string() } else { task.expected_outputs.join(", ") },
    );
    fs::write(workspace_dir.join("execution_prompt.md"), execution_prompt)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn disk_templates_root() -> Option<PathBuf> {
    let compiled = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("templates/test_tasks");
    if compiled.is_dir() {
        return Some(compiled);
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = [
                dir.join("templates/test_tasks"),
                dir.join("../templates/test_tasks"),
                dir.join("../../templates/test_tasks"),
            ];
            for candidate in candidates {
                if candidate.is_dir() {
                    return Some(candidate);
                }
            }
        }
    }

    if let Ok(resource_dir) = crate::service::config::get_resource_dir() {
        let candidate = resource_dir.join("templates/test_tasks");
        if candidate.is_dir() {
            return Some(candidate);
        }
    }

    None
}

fn list_test_tasks_from_disk(root: &Path) -> Vec<TestTaskTemplate> {
    let mut tasks = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return tasks;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let Some(id) = path.file_name().map(|n| n.to_string_lossy().to_string()) else {
            continue;
        };
        let Some(manifest) = read_disk_manifest(&path.join("manifest.json")) else {
            continue;
        };
        tasks.push(TestTaskTemplate {
            id,
            name: manifest.name,
            description: manifest.description,
            category: manifest.category,
            order: manifest.order,
            allow_net: manifest.allow_net,
            expected_outputs: manifest.expected_outputs,
            user_prompt: read_disk_text(&path.join("prompt.md")).unwrap_or_default(),
            system_prompt: read_disk_text(&path.join("system.md")),
            plan: read_disk_text(&path.join("plan.md")),
            docs: read_disk_docs(&path.join("docs")),
        });
    }

    tasks.sort_by_key(|t| t.order);
    tasks
}

fn list_test_tasks_from_embedded() -> Vec<TestTaskTemplate> {
    let mut tasks = Vec::new();

    for entry in TEST_TASKS_DIR.dirs() {
        let id = entry
            .path()
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if id.is_empty() {
            continue;
        }

        let Some(manifest) = load_embedded_manifest(entry) else {
            continue;
        };

        tasks.push(TestTaskTemplate {
            id,
            name: manifest.name,
            description: manifest.description,
            category: manifest.category,
            order: manifest.order,
            allow_net: manifest.allow_net,
            expected_outputs: manifest.expected_outputs,
            user_prompt: load_embedded_file(entry, "prompt.md").unwrap_or_default(),
            system_prompt: load_embedded_file(entry, "system.md"),
            plan: load_embedded_file(entry, "plan.md"),
            docs: load_embedded_docs(entry),
        });
    }

    tasks.sort_by_key(|t| t.order);
    tasks
}

fn read_disk_manifest(path: &Path) -> Option<TaskManifest> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn read_disk_text(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    let trimmed = content.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(content)
    }
}

fn read_disk_docs(docs_dir: &Path) -> Vec<DocFile> {
    let mut docs = Vec::new();
    let Ok(entries) = fs::read_dir(docs_dir) else {
        return docs;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().map(|n| n.to_string_lossy().to_string()) else {
            continue;
        };
        if filename == ".gitkeep" {
            continue;
        }
        if let Ok(content) = fs::read_to_string(&path) {
            docs.push(DocFile { filename, content });
        }
    }
    docs
}

fn load_embedded_manifest(dir: &Dir) -> Option<TaskManifest> {
    let file = find_embedded_file(dir, "manifest.json")?;
    serde_json::from_slice(file.contents()).ok()
}

fn load_embedded_file(dir: &Dir, filename: &str) -> Option<String> {
    let file = find_embedded_file(dir, filename)?;
    let content = String::from_utf8_lossy(file.contents()).to_string();
    if content.trim().is_empty() {
        None
    } else {
        Some(content)
    }
}

fn load_embedded_docs(dir: &Dir) -> Vec<DocFile> {
    let mut docs = Vec::new();
    let Some(docs_dir) = find_embedded_dir(dir, "docs") else {
        return docs;
    };

    for file in docs_dir.files() {
        let Some(filename) = file.path().file_name().map(|n| n.to_string_lossy().to_string()) else {
            continue;
        };
        if filename == ".gitkeep" {
            continue;
        }
        docs.push(DocFile {
            filename,
            content: String::from_utf8_lossy(file.contents()).to_string(),
        });
    }
    docs
}

fn find_embedded_file<'a>(dir: &'a Dir, filename: &str) -> Option<&'a File<'a>> {
    dir.files()
        .find(|file| file.path().file_name().and_then(|n| n.to_str()) == Some(filename))
}

fn find_embedded_dir<'a>(dir: &'a Dir, name: &str) -> Option<&'a Dir<'a>> {
    dir.dirs()
        .find(|child| child.path().file_name().and_then(|n| n.to_str()) == Some(name))
}

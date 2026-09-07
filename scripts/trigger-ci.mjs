import { execSync, spawnSync } from "node:child_process";

function run(cmd, args = []) {
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: true });
  return res.status;
}

console.log("[ci:trigger] 正在触发 GitHub Actions CI 工作流...");

// 1. 触发工作流
const trigger = spawnSync("gh", ["workflow", "run", "ci.yml"], { stdio: "inherit", shell: true });
if (trigger.status !== 0) {
  process.exit(trigger.status ?? 1);
}

// 2. 等待 3 秒让 GitHub 后台生成 run 记录
console.log("[ci:trigger] 已发送触发请求，等待排队生成执行记录...");
spawnSync("node", ["-e", "setTimeout(() => {}, 3500)"]);

// 3. 获取最新对应的 run id
try {
  const runIdStr = execSync(
    'gh run list --workflow=ci.yml --limit 1 --json databaseId --jq ".[0].databaseId"',
    { encoding: "utf-8" }
  ).trim();

  if (!runIdStr) {
    console.log("[ci:trigger] 未能即时捕获 run ID，请使用 gh run watch 查看最新运行。");
    process.exit(0);
  }

  console.log(`[ci:trigger] 捕获到 Workflow Run ID: ${runIdStr}，开始实时监听执行进度与日志...\n`);

  // 4. 实时监听并输出进度 (watch 命令)
  const watchStatus = run("gh", ["run", "watch", runIdStr, "--exit-status"]);

  if (watchStatus !== 0) {
    console.log("\n[ci:trigger] ⚠️ CI 执行失败，正在自动回传失败步骤日志:\n");
    run("gh", ["run", "view", runIdStr, "--log-failed"]);
    process.exit(watchStatus ?? 1);
  } else {
    console.log("\n[ci:trigger] CI 执行成功！");
  }
} catch (err) {
  console.error("[ci:trigger] 监听过程异常:", err.message);
  process.exit(1);
}

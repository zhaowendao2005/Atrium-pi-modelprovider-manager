import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const dist = path.join(root, "dist");
const packageDir = path.join(dist, "pi-modelprovider-manager");

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });

for (const file of ["index.js", "index.js.map", "index.d.ts", "README.md", "package.json"]) {
  const source = path.join(dist, file);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(packageDir, file));
}
for (const directory of ["ui", "bin"]) {
  const source = path.join(dist, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(packageDir, directory), { recursive: true });
}

// 测试任务模板：供 Tauri 测试工作台在运行时发现与扩展
const testTaskTemplates = path.join(root, "src-tauri", "templates", "test_tasks");
if (fs.existsSync(testTaskTemplates)) {
  fs.cpSync(testTaskTemplates, path.join(packageDir, "templates", "test_tasks"), { recursive: true });
}

console.log(`[build] Plugin unit assembled at ${packageDir}`);

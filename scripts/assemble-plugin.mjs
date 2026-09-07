import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const dist = path.join(root, "dist");
const packageDir = path.join(dist, "atrium-pi-modelprovider-manager");

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });

// 1. 复制 Extension 核心产物及类型声明 (排除 .map 源码映射调试文件)
for (const file of ["index.js", "index.d.ts"]) {
  const source = path.join(dist, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(packageDir, file));
  }
}

// 2. 复制运行时适配器模块 (adapters，修复 grok-core 等适配器缺失问题)
const adaptersDir = path.join(dist, "adapters");
if (fs.existsSync(adaptersDir)) {
  fs.cpSync(adaptersDir, path.join(packageDir, "adapters"), { recursive: true });
  for (const f of fs.readdirSync(path.join(packageDir, "adapters"))) {
    if (f.endsWith(".map")) {
      fs.rmSync(path.join(packageDir, "adapters", f), { force: true });
    }
  }
}

// 3. 复制桌面端可执行程序 (bin)
// 注意：ui/ 静态目录无需复制，因为 Tauri 已经将前端全部内嵌进二进制可执行程序中
const binDir = path.join(dist, "bin");
if (fs.existsSync(binDir)) {
  fs.cpSync(binDir, path.join(packageDir, "bin"), { recursive: true });
}

// 4. 复制 README.md 从项目根目录
const readmeSource = path.join(root, "README.md");
if (fs.existsSync(readmeSource)) {
  fs.copyFileSync(readmeSource, path.join(packageDir, "README.md"));
}

// 5. 生成专为插件单元独立运行设计的 package.json (入口指向当前根目录 ./index.js)
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
const pluginPkg = {
  name: rootPkg.name,
  version: rootPkg.version,
  description: rootPkg.description,
  main: "./index.js",
  types: "./index.d.ts",
  type: "module",
  license: rootPkg.license || "MIT",
  keywords: rootPkg.keywords || [],
  publishConfig: rootPkg.publishConfig || {
    access: "public",
    registry: "https://registry.npmjs.org/",
  },
  pi: {
    extensions: ["./index.js"],
  },
  dependencies: rootPkg.dependencies || {},
};
if (rootPkg.author) pluginPkg.author = rootPkg.author;
if (rootPkg.repository) pluginPkg.repository = rootPkg.repository;
if (rootPkg.homepage) pluginPkg.homepage = rootPkg.homepage;
if (rootPkg.bugs) pluginPkg.bugs = rootPkg.bugs;
fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify(pluginPkg, null, 2) + "\n");

// 6. 测试任务模板（供 Tauri 测试工作台在运行时发现与扩展）
const testTaskTemplates = path.join(root, "src-tauri", "templates", "test_tasks");
if (fs.existsSync(testTaskTemplates)) {
  fs.cpSync(testTaskTemplates, path.join(packageDir, "templates", "test_tasks"), { recursive: true });
}

console.log(`[build] Clean plugin unit assembled at ${packageDir}`);

import { syncPresetsAndSchemas } from "../src/utils/preset-extractor.ts";
import path from "node:path";
import { getRuntimeStorageDir } from "../src/utils/runtime-storage.ts";

async function main() {
  console.log("====================================================");
  console.log("[generate:presets] 开始从 Pi 运行时提取官方预设与 Schema...");
  console.log("====================================================");

  const targetDir = getRuntimeStorageDir();

  try {
    const result = await syncPresetsAndSchemas(targetDir);
    console.log("");
    console.log("[generate:presets] 预设提取与分块落盘完成！");
    console.log(`- 目标目录: ${path.join(targetDir, "presets")}`);
    console.log(`- Pi 运行时版本: ${result.version}`);
    console.log(`- 官方提供商总数: ${result.providerCount} 个`);
    console.log(`- 涵盖模型总数: ${result.modelCount} 个`);
    console.log("====================================================");
  } catch (err) {
    console.error("[generate:presets] 提取预设失败:", err);
    process.exit(1);
  }
}

main();

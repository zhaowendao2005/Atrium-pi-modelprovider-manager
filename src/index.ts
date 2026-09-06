import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PiExtensionRuntime } from "./extension-runtime.js";

/**
 * Pi Extension 主入口 (Default Export Factory Function)
 */
export default async function (pi: ExtensionAPI): Promise<void> {
  const runtime = new PiExtensionRuntime(pi);

  // 1. 启动初期从 SQLite 加载并注册 Providers / Models
  await runtime.registerAllProviders();

  // 2. 挂载生命周期钩子
  runtime.registerHooks();

  // 3. 注册控制台 Slash 命令
  runtime.registerCommands();

  // 4. 注册 LLM 可调用的自定义工具
  runtime.registerTools();
}

export * from "./types/index.js";
export * from "./utils/storage.js";
export * from "./extension-runtime.js";

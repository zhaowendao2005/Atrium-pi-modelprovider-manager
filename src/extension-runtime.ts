import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as YAML from "yaml";
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AppConfigYaml, ProviderSchema } from "./types/index.js";
import { INITIAL_CONFIG } from "./utils/storage.js";

const OVERFLOW_PATTERNS = [
  /context_length_exceeded/i,
  /maximum context length/i,
  /prompt is too long/i,
  /exceeds the context window/i,
  /token limit exceeded/i,
  /too many tokens/i,
  /input tokens exceed/i,
];

export class PiExtensionRuntime {
  private pi: ExtensionAPI;
  private configPath: string;
  private registeredProviders = new Set<string>();

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    const home = os.homedir();
    this.configPath = path.join(home, ".pi", "pi-modelprovider-manager-data", "config.yaml");
  }

  public loadYamlConfig(): AppConfigYaml {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, "utf-8");
        return YAML.parse(content) as AppConfigYaml;
      } else {
        // 首次运行创建存储目录与初始 YAML
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.configPath, YAML.stringify(INITIAL_CONFIG), "utf-8");
        return INITIAL_CONFIG;
      }
    } catch (err) {
      console.warn(`[pi-modelprovider-manager] Failed to read ${this.configPath}:`, err);
      return INITIAL_CONFIG;
    }
  }

  public async registerAllProviders(): Promise<void> {
    const config = this.loadYamlConfig();
    for (const provider of config.providers) {
      if (provider.enabled !== false) {
        this.registerProvider(provider);
      }
    }
  }

  public registerProvider(provider: ProviderSchema): void {
    const models = provider.models || [];
    this.pi.registerProvider(provider.id, {
      name: provider.name || provider.id,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      api: provider.api || "openai-completions",
      authHeader: provider.authHeader,
      headers: provider.headers,
      models: models.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        api: m.api,
        baseUrl: m.baseUrl,
        reasoning: m.reasoning || false,
        thinkingLevelMap: m.thinkingLevelMap,
        input: m.input || ["text"],
        contextWindow: m.contextWindow || 128000,
        maxTokens: m.maxTokens || 16384,
        cost: m.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        headers: m.headers,
        compat: m.compat || provider.compat,
      })),
    });
    this.registeredProviders.add(provider.id);
  }

  public registerHooks(): void {
    // 1. session_start
    this.pi.on("session_start", async (_event, ctx: ExtensionContext) => {
      const config = this.loadYamlConfig();
      await this.registerAllProviders();
      if (ctx.hasUI) {
        ctx.ui.setStatus("provider-mgr", `Providers: ${this.registeredProviders.size}`);
      }
    });

    // 2. before_provider_headers (链路追踪)
    this.pi.on("before_provider_headers", (event, ctx: ExtensionContext) => {
      const config = this.loadYamlConfig();
      if (config.settings.enableHeaderTrace) {
        const sid = ctx.sessionManager.getSessionId?.();
        if (sid) {
          event.headers["x-session-id"] = sid;
        }
      }
    });

    // 3. message_end (上下文溢出自动恢复规整)
    this.pi.on("message_end", async (event, _ctx: ExtensionContext) => {
      const message = event.message;
      if (message.role !== "assistant" || message.stopReason !== "error") return;

      const config = this.loadYamlConfig();
      if (!config.settings.enableAutoOverflowRecovery) return;

      const err = message.errorMessage || "";
      if (err.includes("context_length_exceeded")) return;

      if (OVERFLOW_PATTERNS.some((p) => p.test(err))) {
        return {
          message: {
            ...message,
            errorMessage: `context_length_exceeded: ${err}`,
          },
        };
      }
    });
  }

  public registerCommands(): void {
    this.pi.registerCommand("provider", {
      description: "管理和查看已注册的 AI 模型提供商 (/provider [list|reload])",
      handler: async (args: string, ctx: ExtensionCommandContext) => {
        const sub = args.trim().toLowerCase() || "list";
        const config = this.loadYamlConfig();

        if (sub === "list") {
          const list = config.providers
            .map((p) => {
              const count = p.models?.length || 0;
              const status = p.enabled !== false ? "[Active]" : "[Disabled]";
              return `${status} ${p.id} (${p.name || "Unnamed"}) -> ${p.baseUrl} [${count} models]`;
            })
            .join("\n");
          ctx.ui.notify(list ? `【已配置提供商列表】\n${list}` : "暂无配置的提供商", "info");
        } else if (sub === "reload") {
          await this.registerAllProviders();
          ctx.ui.notify("已从 config.yaml 重新加载并注册所有提供商！", "info");
        } else {
          ctx.ui.notify("用法: /provider [list|reload]", "warning");
        }
      },
    });
  }

  public registerTools(): void {
    const self = this;
    this.pi.registerTool({
      name: "provider_list",
      label: "List Providers",
      description: "Query registered LLM providers, endpoints and available models",
      promptSnippet: "Inspect available AI model providers and active configurations",
      promptGuidelines: [
        "Use provider_list when you need to inspect configured model providers or check available models.",
      ],
      parameters: Type.Object({}),
      async execute() {
        const config = self.loadYamlConfig();
        const data = config.providers.map((p) => ({
          id: p.id,
          name: p.name,
          baseUrl: p.baseUrl,
          api: p.api,
          enabled: p.enabled !== false,
          models: p.models?.map((m) => ({ id: m.id, name: m.name, reasoning: m.reasoning })),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
          details: data,
        };
      },
    });
  }
}

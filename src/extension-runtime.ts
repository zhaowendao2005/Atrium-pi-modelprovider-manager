import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { getRuntimeStorageDir } from "./utils/runtime-storage.js";
import * as path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AppSettings, ModelInputType, ModelSchema, ProviderSchema } from "./types/index.js";
import { adapterForPreset, resolveAdapterPolicy } from "./adapters/factory.js";
import type { AdapterRequestContext } from "./adapters/types.js";
import { ModelManagerComponent } from "./model-manager-ui.js";
import { parseRecentModels, RECENT_MODELS_META_KEY, recordRecentModel, recentKey } from "./model-manager-recent.js";
import type { ModelManagerData, ModelManagerItem, RecentModelUse } from "./model-manager-types.js";

const OVERFLOW_PATTERNS = [/context_length_exceeded/i, /maximum context length/i, /prompt is too long/i, /exceeds the context window/i, /token limit exceeded/i, /input tokens exceed/i];
const DEFAULT_SETTINGS: AppSettings = { theme: "auto", enableHeaderTrace: true, enableAutoOverflowRecovery: true, activeProviderId: "" };

type Row = Record<string, any>;
function json<T>(value: unknown, fallback?: T): T | undefined {
  if (typeof value !== "string" || !value) return fallback;
  try { return JSON.parse(value) as T; } catch { throw new Error(`Invalid JSON in manager.db: ${value.slice(0, 40)}`); }
}
function bool(value: unknown, fallback = false): boolean { return value === undefined || value === null ? fallback : Boolean(Number(value)); }

export class PiExtensionRuntime {
  private readonly pi: ExtensionAPI;
  private readonly dbPath: string;
  private registeredProviders = new Set<string>();
  private providers: ProviderSchema[] = [];
  private policies = new Map<string, { provider: ProviderSchema; model: ModelSchema; policy: ReturnType<typeof resolveAdapterPolicy> }>();
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private recentModels: RecentModelUse[] = [];

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    this.dbPath = path.join(getRuntimeStorageDir(), "manager.db");
  }

  public async loadFromDb(): Promise<{ providers: ProviderSchema[]; settings: AppSettings }> {
    const sqliteModuleName = ["node", "sqlite"].join(":");
    const { DatabaseSync } = await import(sqliteModuleName);
    const db: DatabaseSyncType = new DatabaseSync(this.dbPath, { readOnly: true });
    try {
      db.exec("PRAGMA query_only = ON");
      const providerRows = db.prepare("SELECT * FROM providers WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC").all() as Row[];
      const modelRows = db.prepare("SELECT * FROM models ORDER BY provider_id ASC, sort_order ASC, created_at ASC").all() as Row[];
      const models = new Map<string, ModelSchema[]>();
      for (const row of modelRows) {
        const model: ModelSchema = {
          id: row.id, name: row.name ?? undefined, family: row.family ?? undefined, api: row.api ?? undefined,
          baseUrl: row.base_url ?? undefined, reasoning: bool(row.reasoning), input: json(row.input_json, ["text"]),
          contextWindow: row.context_window ?? 128000, maxTokens: row.max_tokens ?? 16384,
          cost: json(row.cost_json), thinkingLevelMap: json(row.thinking_level_map_json), samplingParams: json(row.sampling_params_json),
          headers: json(row.headers_json), compat: json(row.compat_json), appliedPreset: row.applied_preset ?? undefined, sortOrder: row.sort_order ?? 0,
        };
        const list = models.get(row.provider_id) || []; list.push(model); models.set(row.provider_id, list);
      }
      const providers = providerRows.map((row): ProviderSchema => ({
        id: row.id, name: row.name ?? undefined, baseUrl: row.base_url, apiKey: row.api_key ?? undefined, api: row.api,
        authHeader: bool(row.auth_header, true), enabled: bool(row.enabled, true), autoDiscover: bool(row.auto_discover, true),
        discoveryEndpoint: row.discovery_endpoint ?? undefined, oauth: row.oauth ?? undefined, env: json(row.env_json), headers: json(row.headers_json),
        compat: json(row.compat_json), modelOverrides: json(row.model_overrides_json), appliedPreset: row.applied_preset ?? undefined,
        createdAt: row.created_at, updatedAt: row.updated_at, models: models.get(row.id) || [],
      }));
      this.recentModels = [];
      const metaRows = db.prepare("SELECT key, value FROM app_meta").all() as Row[];
      const settings = { ...DEFAULT_SETTINGS } as AppSettings;
      for (const row of metaRows) {
        const value = json(row.value);
        if (row.key === RECENT_MODELS_META_KEY) this.recentModels = parseRecentModels(value);
        else if (row.key in settings && value !== undefined) (settings as any)[row.key] = value;
      }
      return { providers, settings };
    } finally { db.close(); }
  }

  private async refreshSnapshot(): Promise<void> {
    if (!requireDb(this.dbPath)) { console.info(`[provider-mgr] manager.db not found: ${this.dbPath}`); this.providers = []; this.settings = { ...DEFAULT_SETTINGS }; return; }
    const snapshot = await this.loadFromDb();
    this.providers = snapshot.providers; this.settings = snapshot.settings;
  }

  public async registerAllProviders(): Promise<void> {
    await this.refreshSnapshot();
    const next = new Set(this.providers.map((provider) => provider.id));
    for (const id of this.registeredProviders) {
      if (!next.has(id)) this.unregisterProvider(id);
    }
    this.policies.clear();
    for (const provider of this.providers) {
      const models = (provider.models || []).map((model) => {
        const overridden = { ...model, ...(provider.modelOverrides?.[model.id] || {}) };
        return {
          ...overridden,
          api: overridden.api || provider.api || "openai-completions",
          baseUrl: overridden.baseUrl || provider.baseUrl,
          headers: { ...(provider.headers || {}), ...(overridden.headers || {}) },
          compat: { ...(provider.compat || {}), ...(overridden.compat || {}) },
          input: (overridden.input?.length ? overridden.input : ["text"]) as ModelInputType[],
          contextWindow: overridden.contextWindow || 128000,
          maxTokens: overridden.maxTokens || 16384,
          cost: overridden.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        };
      });
      const effectiveProvider = { ...provider, models };
      this.registerProvider(effectiveProvider);
      for (const model of models) {
        this.policies.set(`${provider.id}\0${model.id}`, { provider: effectiveProvider, model, policy: resolveAdapterPolicy(effectiveProvider, model) });
      }
    }
    console.info(`[provider-mgr] loaded ${this.providers.length} providers and ${this.policies.size} model policies`);
  }

  private unregisterProvider(id: string): void {
    const api = this.pi as any;
    if (typeof api.unregisterProvider === "function") api.unregisterProvider(id);
    this.registeredProviders.delete(id);
  }

  public registerProvider(provider: ProviderSchema): void {
    const models = provider.models || [];
    this.pi.registerProvider(provider.id, {
      name: provider.name || provider.id, baseUrl: provider.baseUrl, apiKey: provider.apiKey, api: provider.api || "openai-completions",
      authHeader: provider.authHeader, headers: provider.headers,
      models: models.map((model) => ({ id: model.id, name: model.name || model.id, api: model.api, baseUrl: model.baseUrl || provider.baseUrl, reasoning: model.reasoning || false,
        thinkingLevelMap: model.thinkingLevelMap, input: model.input || ["text"], contextWindow: model.contextWindow || 128000,
        maxTokens: model.maxTokens || 16384, cost: model.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, headers: model.headers,
        samplingParams: model.samplingParams, compat: model.compat || provider.compat })),
    });
    this.registeredProviders.add(provider.id);
  }

  private contextFor(ctx: ExtensionContext, event: any): { adapter: any; request: AdapterRequestContext } | undefined {
    const model = (ctx as any).model as any;
    const providerId = model?.provider || event?.provider || "";
    const modelId = model?.id || event?.model || event?.payload?.model || "";
    const entry = this.policies.get(`${providerId}\0${modelId}`);
    if (!entry?.policy) return undefined;
    const adapter = adapterForPreset(entry.policy.presetId);
    if (!adapter) return undefined;
    return { adapter, request: { modelId, providerId, sessionId: ctx.sessionManager.getSessionId?.(), cwd: (ctx as any).cwd, extensionContext: ctx } };
  }

  public registerHooks(): void {
    this.pi.on("session_start", async (_event, ctx: ExtensionContext) => {
      await this.registerAllProviders();
      if (ctx.hasUI) ctx.ui.setStatus("provider-mgr", `Providers: ${this.registeredProviders.size}`);
    });
    this.pi.on("before_provider_request", (event: any, ctx: ExtensionContext) => {
      const model = (ctx as any).model as any;
      const providerId = model?.provider || event?.provider || "";
      const modelId = model?.id || event?.model || event?.payload?.model || "";
      const entry = this.policies.get(`${providerId}\0${modelId}`);

      // 1. Responses reasoning.status 字段剥离适配（解决 A6 等第三方 Responses 中转站报 status 字段校验失败）
      const omitStatus = entry?.model.compat?.omitResponsesReasoningStatus ?? entry?.provider.compat?.omitResponsesReasoningStatus ?? false;
      if (omitStatus && event?.payload && Array.isArray(event.payload.input)) {
        for (const item of event.payload.input) {
          if (typeof item === "object" && item !== null && item.type === "reasoning" && "status" in item) {
            delete (item as any).status;
          }
        }
      }

      // 2. 路由到特定 Preset 适配器处理 (如 Grok 适配器)
      const routed = this.contextFor(ctx, event);
      if (routed) routed.adapter.beforeRequest(event.payload, routed.request);
    });
    this.pi.on("before_provider_headers", (event: any, ctx: ExtensionContext) => {
      if (this.settings.enableHeaderTrace) {
        const sid = ctx.sessionManager.getSessionId?.(); if (sid) event.headers["x-session-id"] = sid;
      }
      const routed = this.contextFor(ctx, event);
      if (routed && routed.request.sessionId) routed.adapter.beforeHeaders(event.headers, routed.request);
    });
    this.pi.on("message_end", async (event: any) => {
      const message = event.message;
      if (message.role !== "assistant" || message.stopReason !== "error" || !this.settings.enableAutoOverflowRecovery) return;
      const error = message.errorMessage || "";
      if (!error.includes("context_length_exceeded") && OVERFLOW_PATTERNS.some((pattern) => pattern.test(error))) {
        return { message: { ...message, errorMessage: `context_length_exceeded: ${error}` } };
      }
    });
  }

  private buildModelManagerData(ctx: ExtensionContext): ModelManagerData {
    const current = (ctx as any).model as { provider?: string; id?: string } | undefined;
    const recent = this.recentModels;
    const recentAt = new Map(recent.map((entry) => [recentKey(entry.providerId, entry.modelId), entry.usedAt]));
    const items: ModelManagerItem[] = [];
    this.providers.forEach((provider, providerOrder) => {
      (provider.models || []).forEach((model, modelOrder) => {
        items.push({
          providerId: provider.id,
          providerName: provider.name || provider.id,
          modelId: model.id,
          modelName: model.name || model.id,
          series: model.family || "Other",
          providerOrder,
          modelOrder,
          usedAt: recentAt.get(recentKey(provider.id, model.id)),
          isCurrent: current?.provider === provider.id && current?.id === model.id,
          provider,
          model,
        });
      });
    });
    return { items, currentProviderId: current?.provider, currentModelId: current?.id, recent };
  }

  private async saveRecentModel(providerId: string, modelId: string): Promise<void> {
    const sqliteModuleName = ["node", "sqlite"].join(":");
    const { DatabaseSync } = await import(sqliteModuleName);
    const db: DatabaseSyncType = new DatabaseSync(this.dbPath);
    try {
      db.exec("PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE");
      const row = db.prepare("SELECT value FROM app_meta WHERE key = ?").get(RECENT_MODELS_META_KEY) as Row | undefined;
      const next = recordRecentModel(parseRecentModels(json(row?.value)), providerId, modelId);
      db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(RECENT_MODELS_META_KEY, JSON.stringify(next));
      db.exec("COMMIT");
      this.recentModels = next;
    } finally { db.close(); }
  }

  private async launchDesktopManager(ctx: ExtensionCommandContext): Promise<void> {
    const extensionDir = path.dirname(fileURLToPath(import.meta.url));
    const executableName = process.platform === "win32" ? "pi-modelprovider-manager.exe" : "pi-modelprovider-manager";
    const candidates = [
      path.join(extensionDir, "bin", executableName),
      path.join(extensionDir, "..", "bin", executableName),
      path.join(process.cwd(), "dist", "pi-modelprovider-manager", "bin", executableName),
    ];
    const executable = candidates.find((candidate) => existsSync(candidate));
    if (!executable) {
      ctx.ui.notify("未找到 Tauri 管理器程序，请先执行完整构建", "error");
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(executable, [], { detached: true, stdio: "ignore", windowsHide: true,
          env: { ...process.env, PI_MODEL_MANAGER_ENV: process.env.PI_MODEL_MANAGER_ENV === "development" ? "development" : "production" } });
        child.once("error", reject);
        child.once("spawn", () => { child.unref(); resolve(); });
      });
      ctx.ui.notify("已请求打开管理器；已有窗口将恢复并置于前台", "info");
    } catch (error) {
      ctx.ui.notify(`启动 Provider 管理器失败: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }

  private async openModelManager(ctx: ExtensionContext, initialQuery?: string): Promise<void> {
    if (!ctx.hasUI) { ctx.ui.notify("当前运行模式没有可用的 TUI", "warning"); return; }
    await this.refreshSnapshot();
    await ctx.ui.custom((tui, theme, _keybindings, done) => new ModelManagerComponent(tui, theme, {
      getData: () => this.buildModelManagerData(ctx),
      onCancel: () => done(null),
      onSelect: async (item) => {
        const model = (ctx as any).modelRegistry?.find(item.providerId, item.modelId);
        if (!model) { ctx.ui.notify(`未找到模型 ${item.providerId}/${item.modelId}`, "warning"); return; }
        const ok = await (this.pi as any).setModel(model);
        if (!ok) { ctx.ui.notify(`无法切换到模型 ${item.providerId}/${item.modelId}`, "warning"); return; }
        await this.saveRecentModel(item.providerId, item.modelId);
        done(null);
      },
    }, initialQuery));
  }

  public registerCommands(): void {
    this.pi.registerCommand("provider", { description: "管理和查看已注册的 AI 模型提供商 (/provider [list|reload])", handler: async (args: string, ctx: ExtensionCommandContext) => {
      const sub = args.trim().toLowerCase() || "list";
      if (sub === "reload") { await this.registerAllProviders(); ctx.ui.notify("已从 manager.db 重新加载提供商", "info"); return; }
      if (sub === "list") { const list = this.providers.map((p) => `${p.enabled !== false ? "[Active]" : "[Disabled]"} ${p.id} (${p.name || "Unnamed"}) -> ${p.baseUrl} [${p.models?.length || 0} models]`).join("\\n"); ctx.ui.notify(list || "暂无配置的提供商", "info"); return; }
      ctx.ui.notify("用法: /provider [list|reload]", "warning");
    }});
    this.pi.registerCommand("models", { description: "打开 Provider / Model 模型选择器", handler: async (args: string, ctx: ExtensionCommandContext) => {
      await this.openModelManager(ctx, args.trim() || undefined);
    }});
    this.pi.registerCommand("model-manager", { description: "打开 Tauri Provider / Model 管理器", handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await this.launchDesktopManager(ctx);
    }});
    this.pi.registerShortcut("alt+p", { description: "打开 Provider / Model 模型选择器", handler: (ctx: ExtensionContext) => this.openModelManager(ctx) });
  }

  public registerTools(): void {
    const runtime = this;
    this.pi.registerTool({ name: "provider_list", label: "List Providers", description: "Query registered LLM providers and models", promptSnippet: "Inspect configured AI providers", promptGuidelines: ["Use provider_list to inspect configured providers."], parameters: Type.Object({}), async execute() {
      const data = runtime.providers.map((p: ProviderSchema) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, api: p.api, enabled: p.enabled !== false, models: p.models?.map((m: ModelSchema) => ({ id: m.id, name: m.name, reasoning: m.reasoning })) }));
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], details: data };
    }});
  }
}

function requireDb(dbPath: string): boolean {
  try { return existsSync(dbPath); } catch { return false; }
}

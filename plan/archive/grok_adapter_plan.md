# SQLite 单一数据源与预设驱动型 Grok Harness 适配器实施计划

## 0. 已确认的边界与决策

本计划按当前项目仍处于开发期处理，不以旧版本数据兼容为目标。

1. **SQLite 从本次版本起唯一生效**
   - 用户配置只存储在 `~/.pi/pi-modelprovider-manager-data/manager.db`。
   - 不再读取或写入 `config.yaml`。
   - 不再读取或写入 `localStorage`。
   - 不实现旧 YAML、旧 localStorage 到 SQLite 的迁移，也不提供旧数据兼容回退。
   - 实施前可以直接删除开发机上的旧 `manager.db`、`config.yaml` 和相关 localStorage 数据。
   - DB 不存在时由 Tauri 端创建空数据库；扩展端只读不到数据并输出明确日志，不生成 YAML、不写回默认配置。

2. **平台范围以 Windows 为主**
   - 文件路径、Tauri command、Pi 子进程启动和数据库访问优先保证 Windows。
   - 代码避免无必要的 Windows 专用实现，未来可兼容 macOS/Linux。
   - 本计划不增加 macOS/Linux 的实机验证矩阵，也不把跨平台验证作为交付阻塞条件。

3. **SQLite schema 采用单一固定版本**
   - 重新定义当前开发版 schema，初始化时使用 `CREATE TABLE IF NOT EXISTS`。
   - 不实现历史 schema migration。
   - 开发期间如 schema 变化，删除开发数据库重新初始化。
   - 可设置 `PRAGMA user_version = 1` 做运行时一致性检查，但不实现从旧版本升级；版本不匹配时直接报错并提示删除数据库。

4. **保存必须具有原子性**
   - provider、其 models 和删除的旧 models 在一次事务中完成。
   - 单独保存 model 也必须在事务中完成。
   - 扩展端只读 DB，Tauri 端负责全部写操作。

5. **适配器是用户可见的 preset 能力，不增加孤立开关**
   - 用户在 Tauri 中给 provider 或 model 指定 preset 后，运行时按 preset 解析 adapter。
   - 不通过模型名、provider 名或 URL 猜测是否启用 Grok adapter。
   - preset 未指定、指定为 `custom` 或未注册的 preset，不自动启用 Grok adapter。
   - 适配器策略通过独立的 preset registry 显式声明，便于用户理解和未来扩展。

6. **preset 作用域优先级固定**
   - 按项目决策，`model preset < provider preset`：provider preset 的 adapter policy 优先于 model preset。
   - 只有 provider 未提供可识别的 adapter policy 时，才使用 model preset 的 policy。
   - 两者均未指定有效 adapter 时，不执行适配器。
   - 这条规则必须在 adapter factory 和测试沙箱中使用同一份实现，不能由调用方各自判断。

7. **Grok 目标是恢复 Pi 的 harness/agentic 请求能力**
   - 沿用 `pi-xai` 的模型请求处理部分。
   - 继续使用 Pi 原生 `openai-responses` driver，不重写 streamer。
   - 不移植 `pi-xai` 的 OAuth 登录、CLI proxy 专用认证、多媒体工具、`/goal`、`/plan` 或独立的 `xai_generate_text` 工具。
   - 普通 relay 使用 Pi 的 `authHeader`/API Key 机制。API Key 必须原样交给 Pi 的请求层，adapter 不读取、打印或改写私钥内容。
   - `x-grok-conv-id` 作为由 preset policy 控制的可选会话 Header；不因为 URL 或模型名自动向所有 xAI 请求添加 CLI proxy Header。

8. **测试页必须和真实请求使用同一份适配逻辑**
   - 不能在 Rust 中维护一份手写的 Grok 清洗代码。
   - 生产扩展和测试沙箱加载相同的 adapter core 构建产物。
   - Rust 只注入本次测试的 provider/model 配置和 adapter policy，不复制请求转换逻辑。

---

## 1. 当前实现与本次改造范围

### 1.1 必须移除的旧链路

| 位置 | 当前行为 | 本次行为 |
| :--- | :--- | :--- |
| `src/extension-runtime.ts` | 读取 `config.yaml`，首次启动写默认 YAML | 使用 `node:sqlite` 只读 `manager.db`，不创建配置文件 |
| `src/stores/provider.ts` | SQLite 与 YAML/localStorage 逻辑并存 | 仅调用 SQLite command，失败直接暴露错误 |
| `src/stores/settings.ts` | 通过 YAML 字符串保存设置 | 通过 `app_meta` 保存 JSON 设置 |
| `src/utils/storage.ts` | YAML 序列化、localStorage fallback、初始 YAML | 删除配置存储职责；移除 YAML/localStorage 配置 API |
| `src/views/settings/SettingsView.vue` | YAML 路径和 YAML 预览 | 展示 DB 路径、状态、统计和备份/导出操作 |
| `src-tauri/src/service/config/mod.rs` | YAML 读写命令和 YAML 路径 | 删除 YAML command，仅保留 DB 路径或 DB 相关信息接口 |
| `src-tauri/src/main.rs` | 注册 YAML commands | 删除 YAML commands，注册新的 DB/settings commands |
| `package.json`、Rust manifest | 配置链路依赖 `yaml`/`serde_yaml` | 若全仓库确认无导入，移除生产依赖 |
| `docs/`、`AGENTS.md` | 把 YAML 描述为配置来源 | 改为 SQLite 单一配置来源，并注明开发期无旧数据迁移 |

预设生成器生成的 `presets/*.json` 是官方预设缓存，不是用户配置。它可以继续作为静态预设目录存在；“SQLite 单一来源”在本计划中指用户 provider、model 和应用设置，不强行把静态预设构建产物当作用户配置表。

### 1.2 不做的事情

- 不迁移旧 YAML。
- 不迁移旧 localStorage。
- 不保留 YAML 兜底读取。
- 不实现 schema 历史版本升级。
- 不为 macOS/Linux 增加完整 CI 或人工测试矩阵。
- 不移植 `pi-xai` 的 OAuth 和官方 CLI proxy 登录流程。
- 不实现 Grok 专用自定义工具和媒体能力。
- 不为 adapter 增加用户手动启用开关。
- 不增加大量模拟 API 的自动化测试；以构建检查、结构性复用、桩日志和测试页人工端到端验证为主。

---

## 2. 固定 SQLite 数据结构

### 2.1 schema 设计

以当前 `src-tauri/src/service/db/mod.rs` 为基础，整理成一个干净的固定 schema。需要补齐当前类型中会影响无损还原的字段：

- `providers.model_overrides_json`：保存 `ProviderSchema.modelOverrides`。
- `models.sort_order`：保持 Tauri 中的模型顺序稳定。
- 现有 JSON 字段继续使用 JSON 文本保存：`env_json`、`headers_json`、`compat_json`、`input_json`、`cost_json`、`thinking_level_map_json`、`sampling_params_json`。
- 布尔字段继续使用 SQLite integer 0/1，并在读写时显式转换。
- `NULL` 和缺省值的映射必须与 TypeScript Schema 一致，不能把空对象、空数组和 `undefined` 混为一谈。

固定表：

```text
providers
models
app_meta
official_presets  -- 仅在现有预设缓存链路确实需要时保留
```

`official_presets` 不作为本次用户配置读写的前置条件。若仍保留，必须明确它由预设生成流程写入，不能在设置页统计中假装已经被使用。

### 2.2 Tauri DB API

保留并整理：

```text
db_load_all
 db_save_provider
 db_save_model
 db_delete_provider
 db_delete_model
```

补充或整理：

```text
db_get_path
db_get_health
db_get_stats
db_backup
db_export_json
app_meta_load
app_meta_save
```

具体要求：

1. `db_save_provider` 使用事务完成 provider upsert、models upsert 和已删除 models 清理。
2. provider 不存在时，单独的 `db_save_model` 必须失败，不能静默创建孤立 model。
3. `db_delete_provider` 依赖外键级联或在同一事务内删除关联 models。
4. `db_load_all` 返回完整 `ProviderSchema[]`，包括 `modelOverrides`、所有 model metadata 和顺序。
5. SQL 错误、JSON 解析错误和 schema 错误都返回 Tauri error；前端不再返回空配置作为静默 fallback。
6. 启动时初始化固定 schema。若 `user_version` 与当前固定版本不一致，直接报错并提示开发者删除数据库，不做迁移。
7. 备份在 SQLite 一致性快照上完成，不能直接复制正在写入的文件而不处理一致性。
8. 完整备份和 JSON 导出都必须显式处理 API Key。默认日志和脱敏导出不得包含 API Key；完整 DB 备份属于用户主动操作。

### 2.3 前端存储

- `provider.ts` 的加载、创建、编辑、删除全部使用 SQLite command。
- `settings.ts` 将设置项按 key 保存到 `app_meta`，value 为 JSON 文本。
- 删除 `loadConfigFromYaml`、`saveConfigToYaml` 和 `localStorage` fallback。
- `AppConfigYaml`、YAML 配置导出类型和不再使用的 `configStoragePath` 一并清理。
- Tauri 未加载或 DB command 失败时，UI 显示错误状态并允许重试；不能悄悄显示空 provider 列表。
- 设置页显示由 `db_get_path` 返回的实际路径、数据库健康状态、provider/model 数量和最近错误。
- 设置页可以提供 JSON 导出和 DB 备份，但不能再显示 YAML 预览。

---

## 3. 扩展端 SQLite 直读

### 3.1 运行时约束

扩展使用：

```ts
import { DatabaseSync } from "node:sqlite";
```

当前主要验证环境为 Windows。代码使用 `os.homedir()` 与 `path.join()` 计算：

```text
~/.pi/pi-modelprovider-manager-data/manager.db
```

不引入 `better-sqlite3` 等 Native Addon。由于 `node:sqlite` 在当前 Node 版本仍可能产生 experimental warning，启动时必须：

- 记录实际 DB 路径和读取结果，不记录 API Key。
- DB 不存在时返回空 provider 列表并打印可识别的 info 日志。
- DB 打开失败、schema 不一致或行数据无法解析时打印 error，并让 reload/启动失败可见。
- 使用 `try/finally` 关闭 `DatabaseSync`。
- 使用只读打开和 `PRAGMA query_only = ON`，禁止扩展写数据库。

不实现旧配置 fallback。

### 3.2 Provider 注册

将 DB 行组装为 `ProviderSchema[]`，并保持现有 Pi 注册字段映射：

- provider-level `headers` 传给 `registerProvider`。
- provider-level `compat` 作为默认 compat。
- model-level compat 覆盖 provider-level compat。
- model-level `baseUrl`、`api`、`headers`、`samplingParams`、cost、thinking map 等完整传递。
- `appliedPreset` 不传给 Pi 作为未知字段，而是保存在 runtime adapter policy map 中。
- `modelOverrides` 在注册前按现有项目语义应用，避免 DB 读取后丢失 provider override。

维护：

```text
registeredProviders: Set<string>
adapterPolicies: Map<providerId + "\0" + modelId, AdapterPolicy>
```

执行 reload 时：

1. 从 DB 重新读取全部 provider。
2. 移除上一轮已注册但本轮不存在或已禁用的 provider。
3. 注册当前启用 provider。
4. 重新生成 adapter policy map。
5. 注册失败时输出 provider/model/preset 标识，并保留明确失败状态，不报告成功。

### 3.3 Hooks 接入

只注册一套全局 Hook，由 factory 根据当前 Pi context 找到 policy：

- `before_provider_request`：调用选定 adapter 的请求体处理函数。
- `before_provider_headers`：调用选定 adapter 的 Header 处理函数。
- 保留现有的 overflow recovery 逻辑，但它不属于 Grok adapter。
- 不把 `message_end` citation 排版处理纳入本次 Grok 请求适配；这不是恢复 Pi harness 的必要部分。

定位优先使用 `ctx.model.provider` 和 `ctx.model.id`，必要时使用 payload.model 辅助查找。不能根据 `modelId.startsWith("grok-")` 或 provider ID 包含 `grok` 自动启用 adapter。

---

## 4. 显式 Preset Adapter Factory

### 4.1 文件和接口

新增：

```text
src/adapters/types.ts
src/adapters/registry.ts
src/adapters/grok-core.ts
src/adapters/grok.ts
src/adapters/factory.ts
```

建议接口：

```ts
export interface AdapterPolicy {
  adapterId: string;
  source: "provider-preset" | "model-preset";
  presetId: string;
  injectConversationId?: boolean;
}

export interface AdapterDefinition {
  id: string;
  matchesPreset(presetId: string): boolean;
  beforeRequest(payload: unknown, context: AdapterRequestContext): void;
  beforeHeaders(headers: Record<string, string>, context: AdapterRequestContext): void;
}
```

`factory.ts` 只处理 policy 解析，不处理模型名猜测：

```text
resolveAdapterPolicy(provider, model):
  provider.appliedPreset -> provider policy
  otherwise model.appliedPreset -> model policy
  otherwise no adapter
```

这里的 provider policy 优先级必须高于 model policy，符合本项目确定的 `model preset < provider preset` 规则。

### 4.2 Grok preset registry

Grok adapter 通过明确的 preset ID 注册，而不是模糊匹配：

- `xai`
- `grok-4.6`
- `grok-composer-2.5-fast`
- `grok-build`
- `grok-4.5`
- `grok-4.3`
- `grok-4.20-0309-reasoning`
- `grok-4.20-0309-non-reasoning`
- `grok-4.20-multi-agent-0309`

如果未来增加新的 Grok preset，必须在 registry 中显式添加，不能因为名称前缀自动生效。

### 4.3 Grok 请求处理的精确移植范围

以 `D:/code/参考项目/pi-xai-main` 的请求处理实现为行为参考，移植纯请求处理能力：

1. 继续使用 Pi 的 `openai-responses`。
2. 在 `before_provider_request` 中原地处理 payload，不替换用户 prompt，不修改 API Key。
3. 清理已确认会导致 xAI/relay 拒绝的字段：
   - `seed`
   - `parallel_tool_calls`
   - `prompt_cache_retention`
   - `service_tier`
4. 保留并清理 Pi harness 的 client-side `tools`，绝不能把现有 Pi 工具数组替换成空数组或仅保留服务端工具。
5. 移植参考实现中的工具 schema slash enum 清理和空 tools 清理。
6. 移植 `temperature`、`top_p` 的合法范围规整。
7. 按模型能力处理 `reasoning.effort`，删除 xAI 不接受的额外 reasoning 字段，而不是无条件传递整个 OpenAI reasoning 对象。
8. 移植 `reasoning.encrypted_content` include 处理，保证多轮 reasoning/tool continuation 不因缺失加密 reasoning 内容而失败。
9. 移植 Responses `input` 内容规整，覆盖空内容、工具结果和多模态内容的 xAI 兼容形态。
10. `prompt_cache_key` 使用不超过 64 个字符的稳定 session key；截断规则必须明确按 Unicode code point 处理，不能简单按 UTF-16 code unit 截断。
11. 请求处理函数必须是可重复调用的，不重复追加 include、tools 或 Header。

不移植：

- `pi-xai` OAuth provider 配置。
- `cli-chat-proxy.grok.com` 的 OAuth/static CLI identification headers。
- 独立 xAI custom tools。
- 生图、生视频、`/goal`、`/plan` 等非请求 harness 逻辑。
- citation 文本排版。

### 4.4 Header 处理

普通 API Key relay 继续使用 provider 的 `authHeader`，adapter 不覆盖 `Authorization`。

如果 Grok preset policy 设置 `injectConversationId`，则在 `before_provider_headers` 中：

```text
x-grok-conv-id = ctx.sessionManager.getSessionId()
```

要求：

- 没有 session ID 时不添加 Header，并记录原因。
- 只对已由 preset policy 命中的请求添加。
- 不根据 base URL 猜测 CLI proxy。
- 不添加官方 CLI proxy 的 OAuth/static headers。
- 不记录 Header 值、Authorization 值或 API Key，只记录是否添加和 session ID 长度。

---

## 5. 生产扩展与测试沙箱共用适配器

### 5.1 单一构建产物

新增一个不依赖 Pi/Tauri 的 adapter core 构建入口，例如：

```text
src/adapters/grok-core.ts
-> dist/shared/grok-core.mjs
```

生产扩展通过相对路径加载该构建产物；测试沙箱也使用同一个构建产物。不要在 `src-tauri/src/service/test_runner/mod.rs` 中复制 Grok 清洗函数。

建议调整构建流程：

1. `build:ext` 同时生成扩展入口和 `dist/shared/grok-core.mjs`。
2. `dev` 在 `tauri dev` 前确保该文件已经生成。
3. Tauri 构建时把该构建产物作为资源或通过 `include_str!` 嵌入，启动测试时写入 workspace 的 `sandbox_adapter.mjs`。
4. 生成的 `sandbox_provider.mjs` 只负责注册本次测试的 provider、挂载统一 adapter hook 和传入 policy。
5. 生产与沙箱在启动日志中打印 adapter core 的版本/hash，便于发现构建产物不一致。

这样 Rust 不拥有第二份协议逻辑，测试使用的 JS adapter 与生产使用的 JS adapter 是同一份构建结果。

### 5.2 沙箱配置完整性

`start_pi_agent_rpc` 传给沙箱的配置必须至少包括：

```text
providerId
provider-level preset/policy
model-level appliedPreset
model id/name/api/baseUrl/reasoning
model headers/compat/samplingParams
provider headers/compat/authHeader
apiKey 和 baseUrl
```

API Key 只通过进程环境或 Pi provider 配置注入，不写入普通测试日志。沙箱不应再次从宿主 YAML、localStorage 或宿主 session 读取配置。

沙箱脚本启动时输出结构化桩日志：

```text
providerId
modelId
resolved preset
resolved adapterId
policy source
removed payload fields
prompt_cache_key length
conversation header injected: true/false
```

日志严禁输出完整 prompt、Authorization、API Key、完整 payload 和 Header 值。

### 5.3 测试页人工验证

不构建大规模自动化测试矩阵。开发验收只需在 Tauri 测试页：

1. 创建或选择一个普通 relay provider。
2. 给 provider 或 model 指定 Grok preset，确认 adapter policy 命中。
3. 发起一次真实测试请求，检查桩日志和最终请求结果。
4. 使用同一模型重复请求，确认 session Header 和 prompt cache key 日志行为符合预期。
5. 去掉 preset 或指定 `custom`，确认 adapter 不执行。
6. 选择普通非 Grok preset，确认不受 Grok 清洗影响。
7. 若请求失败，日志立即暴露解析失败、policy 解析失败、payload 字段处理失败或 Header 注入失败。

最终请求仍以 relay/上游实际返回结果为准；桩日志用于快速定位，不打印敏感数据。

---

## 6. Grok 官方预设数据

在预设生成链中补充并稳定保存以下模型定义：

```text
grok-4.6                         500K / 131K
grok-composer-2.5-fast           200K / 30K
grok-build                       500K / 30K
grok-4.5                         500K / 131K
grok-4.3                         1M
grok-4.20-0309-reasoning         2M
grok-4.20-0309-non-reasoning     2M
grok-4.20-multi-agent-0309       2M
```

每个 preset 必须明确：

- `id`、`name`、`family`
- `api: "openai-responses"`
- `reasoning`
- `thinkingLevelMap`
- `input`
- `contextWindow`
- `maxTokens`
- `cost` 及阶梯计费
- 对应的 adapter registry ID 或 adapter policy

模型规格来源应记录 Pi 版本或参考项目版本。预设数据更新时不能静默覆盖用户已经应用后修改为 `custom` 的模型。

---

## 7. 日志与失败策略

本项目当前优先快速开发和快速定位问题，所有关键失败都不能被空值吞掉。

### 7.1 扩展端日志

记录以下非敏感信息：

- DB 路径、DB 是否存在、provider/model 数量。
- DB schema 不一致、JSON 字段解析失败、provider 注册失败。
- reload 前后 provider 数量和被移除的 provider ID。
- adapter 命中的 preset ID、policy 来源和 adapter ID。
- 删除了哪些 payload 字段、cache key 长度、是否注入 conversation Header。

禁止记录：

- API Key、Authorization Header 和 OAuth token。
- 完整 prompt、完整 payload、完整 Header。
- session ID 原文。

### 7.2 失败原则

- SQLite 打开或 schema 错误：启动/reload 明确失败，不切换到 YAML/localStorage。
- preset 不识别：记录 warning，adapter 不执行，并显示可定位的 preset ID。
- adapter payload 结构异常：记录字段路径和类型，必要时让请求失败，不静默伪造请求。
- Tauri 测试脚本生成失败：测试立即失败，不启动一个没有 adapter 的假沙箱。
- 生产和沙箱 adapter core hash 不一致：测试启动前直接报错。

---

## 8. 实施路线

### 第一步：固定 SQLite 数据链路

- 清理开发机旧 YAML/localStorage 数据。
- 更新固定 schema，增加 `model_overrides_json` 和 model `sort_order`。
- 将 provider/model 保存改为事务。
- 完成 `db_load_all` 的完整字段映射。
- 添加 `app_meta` 读写和 DB health/stats/path/backup/export commands。
- 修改 Pinia stores 和 SettingsView，删除 YAML/localStorage 逻辑。
- 删除 YAML Tauri commands、类型、依赖和文档引用。

### 第二步：扩展端直读 DB

- 在 `src/extension-runtime.ts` 中使用 `DatabaseSync` 只读 `manager.db`。
- 完成完整 provider/model 组装和 `modelOverrides` 应用。
- 实现 reload 时移除旧 provider。
- 保留现有 provider command/tool/overflow recovery，但所有配置读取改为 SQLite runtime snapshot。
- 增加 DB 错误和空 DB 的清晰日志。

### 第三步：预设 registry 与 adapter policy

- 添加 adapter types、registry、factory 和 policy map。
- 实现 `model preset < provider preset` 的固定解析顺序。
- 只按显式 preset ID 命中，不按模型名/provider 名/URL 猜测。
- 在 Grok preset 数据中登记 adapter policy。

### 第四步：移植 Grok 请求 core

- 以 `pi-xai` 请求实现为参考，移植 payload 清洗、reasoning replay、input 规整、tools 保留、cache key 和可选 conversation Header。
- 不移植 OAuth、CLI proxy 认证和非请求功能。
- 继续让 Pi 的 `openai-responses` 负责实际流式通信。

### 第五步：接入生产与测试沙箱

- 将 Grok core 作为独立构建产物。
- 生产扩展和 Rust 测试沙箱加载同一个产物。
- 删除 Rust 内联 adapter 逻辑。
- 传递完整 provider/model/preset policy 配置。
- 增加 adapter core hash 和结构化桩日志。

### 第六步：最小验证

执行 Windows 开发环境下的：

```text
pnpm typecheck
pnpm run build:ext
pnpm run build:ui
pnpm run build:tauri
```

然后在 Tauri 测试页人工验证一个选定 Grok preset 的 relay 模型，并验证取消 preset 后 adapter 不再执行。macOS/Linux 不作为本次交付验证平台。

---

## 9. 交付验收清单

- [ ] 所有用户配置只通过 `manager.db` 持久化。
- [ ] 扩展端不再读取/写入 `config.yaml` 或 localStorage。
- [ ] 开发期旧数据不迁移，DB 不存在时行为明确。
- [ ] 固定 schema 包含 `modelOverrides`、model 顺序和所有模型规格字段。
- [ ] provider + models 保存具有事务原子性。
- [ ] Tauri 写入后，扩展重启/reload 可以完整读取同一份 DB。
- [ ] reload 会移除已经禁用或删除的 provider。
- [ ] adapter 只由显式 preset policy 命中。
- [ ] provider preset 优先于 model preset，规则在生产与沙箱一致。
- [ ] Grok 请求清洗不会删除 Pi harness tools，不修改 prompt 或 API Key。
- [ ] Grok request core 来自同一份构建产物，Rust 没有重复实现。
- [ ] 测试页能够显示 policy、清洗字段和 Header 注入的桩日志。
- [ ] 选定 Grok preset 的人工真实请求可以完成；取消 preset 后普通模型请求不受 Grok adapter 影响。
- [ ] 日志不泄露 API Key、Authorization、session ID、prompt 或完整 payload。

# Pi Provider / Model 插件完整实现计划

## 一、规格：我的原始意图

### 1. 产品本质

本项目不是一个单纯的模型列表选择器，也不是桌面端配置页面的附属工具。

它本质上是一个面向 Pi Agent 的 Provider / Model 插件，承担完整的运行时职责：

```text
SQLite 配置
  -> Pi Extension 读取配置
    -> 注册 Provider 与 Model
      -> 解析有效模型参数
        -> 请求 hooks
          -> adapter / patch 执行
            -> Pi Agent 发起并完成请求
```

同时提供两个用户界面：

```text
Pi Agent 内的 TUI 模型选择器
  -> 快速搜索和选择当前模型

Tauri + Vue 桌面管理器
  -> Provider / Model 的复杂配置、预设、兼容性参数、补丁、hooks 和测试
```

TUI 和 Tauri 管理器不是两个互相独立的产品，而是同一个 Provider / Model 运行时系统的两个入口：

- Tauri 管理器负责复杂配置和持久化。
- Pi Extension 负责将当前配置注入 Pi Agent 运行时。
- TUI 负责在 Pi Agent 内快速选择已配置的模型。
- hooks 和 adapter 负责把配置转化为实际请求行为。

### 2. 当前项目已存在的核心能力

当前代码已经具备以下基础，后续实现应在其上完善，而不是重新发明一套系统：

#### Pi Extension 运行时

`src/extension-runtime.ts` 当前负责：

- 从 `~/.pi/pi-modelprovider-manager-data/manager.db` 只读加载 Provider 和 Model。
- 按 Provider 的 `enabled` 状态加载运行时配置。
- 将 Provider 和 Model 的 `modelOverrides` 合并为有效模型配置。
- 调用 `pi.registerProvider` 注册 Provider 和 Model。
- 建立 `${providerId}\0${modelId}` 到有效配置和 adapter policy 的索引。
- 在 `before_provider_request` hook 中执行请求载荷补丁和 adapter。
- 在 `before_provider_headers` hook 中执行会话链路追踪和 adapter header 处理。
- 在 `message_end` hook 中处理上下文超长错误恢复。
- 提供 `/provider list` 和 `/provider reload` 基础命令。

#### Adapter

当前 `src/adapters/` 已形成 adapter 体系：

- `types.ts` 定义 AdapterRequestContext、AdapterPolicy 和 AdapterDefinition。
- `factory.ts` 根据 Provider/Model preset 解析 adapter policy。
- `registry.ts` 管理 adapter 注册表和 preset 到 adapter 的映射。
- `grok.ts` 和 `grok-core.ts` 实现请求 payload 清洗、header 注入等具体适配逻辑。

#### Tauri / Vue 管理端

当前桌面管理器已经负责：

- Provider 和 Model 的 SQLite CRUD。
- Provider 与 Model 的层级配置。
- Model family / 系列归类。
- Provider / Model 的有效配置解析。
- Provider 继承、Model 覆盖和默认值回退。
- API 协议、baseUrl、headers、authHeader 等网络配置。
- `compat` 兼容参数。
- `samplingParams`、`thinkingLevelMap`、cost、contextWindow、maxTokens 等模型参数。
- preset 选择和 preset 追踪。
- adapter 相关 preset 映射。
- 测试工作台和连接测试。
- 全局 hooks 相关设置：会话 header trace、上下文超长恢复。

#### 当前存储边界

- Provider、Model、全局设置均以 SQLite 为唯一持久化来源。
- `app_meta` 用于保存全局设置和新增的运行时辅助状态。
- YAML 已弃用，不重新引入 YAML。
- 旧 `custom-providers` 插件与当前项目不同时使用，不做兼容和迁移。

### 3. 本次目标

在不破坏上述完整 Provider / Model 运行链路的前提下，新增并完善：

1. Pi Agent 内的三 Tab TUI 模型选择器。
2. TUI 与当前 SQLite / 当前运行时配置的连接。
3. Provider / Model 有效参数、patch、hooks、adapter 的完整运行闭环。
4. Tauri 管理器作为复杂配置中心的明确职责。
5. 统一的最近使用排序和模型选择状态。
6. 有限但覆盖核心风险的验证。

---

## 二、TUI 模型选择器规格

### 1. 入口

以下两个入口必须打开同一个模型选择器组件：

```text
/models
Alt+P
```

两个入口不实现两套筛选、排序或选择逻辑。

### 2. 三个 Tab

三个 Tab 是切换视图，不是同时并排的三列：

```text
[默认] [提供商] [系列]
```

不得保留旧插件中的 Key、登录、添加等额外 Tab。

#### 默认 Tab

- 展示所有当前已注册且可选择的模型。
- 按最近使用顺序排列。
- 当前正在使用的模型突出显示。
- 从未使用过的模型按照当前 Provider / Model 数据的稳定顺序排列。
- 不按 Provider 或 Series 分组。

#### 提供商 Tab

- 按 Provider 分组展示 Model。
- Provider 排序主要根据其下模型的最近使用情况。
- 最近使用模型所属 Provider 优先。
- Provider 内部模型按最近使用顺序和搜索匹配分数排列。
- 直接命中 Model 的结果优先于仅命中 Provider 名称的结果。

#### 系列 Tab

- 按 `ModelSchema.family` 分组。
- 没有 family 的模型归入 `Other`。
- Series 排序主要根据其下模型的最近使用情况。
- Series 内部模型按最近使用顺序和搜索匹配分数排列。

### 3. 搜索原则

搜索必须是即时搜索，输入变化立即刷新当前 Tab。

核心规则：

> 对候选名称归一化后，查询中的字符必须按照原始顺序出现在候选名称中；字符之间允许跳过任意数量的候选字符，但查询字符不能重排。

归一化规则：

- 转换为小写。
- 移除空格。
- 移除 `-`、`.`、`_`、`/` 等常见模型标识分隔符。
- 保留字母和数字相对顺序。
- 不做语义推断。
- 不做同义词替换。
- 不做模型别名猜测。
- 不将查询拆成必须独立命中的词。

候选示例：

```text
gpt-5.6-terra
gpt-5.6-sol
gpt-5.6-sonnet
```

以下查询按照字符顺序进行匹配：

```text
g 6 l
g6l
gt56sol
sol
g sol
```

以下查询不能视为等价：

```text
gpt sol  != sol gpt
g sol      != sol g
```

`son` 是否命中，只由候选归一化文本中是否存在 `s -> o -> n` 的字符顺序决定。不能因为候选名称包含 `sonnet` 就添加额外语义规则。

### 4. 搜索字段和置信度

TUI 的模型展示项应包含以下搜索字段：

- Provider ID。
- Provider name。
- Model ID。
- Model name。
- Model family。

搜索结果需要保留“命中”与“评分”两个概念：

- 命中：至少一个字段完整满足有序字符匹配。
- 评分：用于不同命中结果排序。

评分优先级：

1. Model ID 的连续或高密度匹配。
2. Model name 的连续或高密度匹配。
3. Model ID 的分散有序匹配。
4. Model name / family 的有序匹配。
5. Provider ID 的匹配。
6. Provider name 的匹配。
7. 最近使用时间。
8. 数据库稳定顺序。

必须保证：

- Model 直接命中优先于 Provider 仅命中。
- 查询字符越集中，置信度越高。
- 跳过字符越少，置信度越高。
- 同分时排序稳定。

### 5. TUI 保留和删除的功能

保留：

- 搜索输入。
- 三 Tab 切换。
- 上下移动。
- Enter 选择当前模型。
- Esc 关闭。
- 当前模型标记。
- 分组显示。
- 列表滚动。
- Emoji 终端表现。

删除：

- Provider 开启/关闭。
- Model 开启/关闭。
- 批量开启/关闭。
- Provider 编辑。
- Provider 添加。
- Provider 删除。
- Model 删除。
- 登录渠道隐藏/显示。
- Alt+Enter 控制菜单。
- 空格控制菜单。
- Key、登录、添加等额外 Tab。

TUI 只负责快速选择已经由管理器配置好的 Provider / Model，不承担复杂配置工作。

### 6. 最近使用状态

最近使用状态属于当前项目运行时辅助状态，不使用旧插件的 `recent-usage.json`。

每次模型选择成功后记录：

```json
{
  "providerId": "provider-id",
  "modelId": "model-id",
  "usedAt": 1730000000000
}
```

建议保存到 SQLite 的 `app_meta`：

```text
model_manager_recent_usage
```

最近使用状态：

- 不修改 Provider 和 Model 实体。
- 不改变 Provider / Model 注册参数。
- 只影响 TUI 排序。
- 按 Provider ID + Model ID 去重。
- 最大保留有限数量，例如 100 条。
- 缺失、损坏或不可读取时回退为空列表。

---

## 三、Provider / Model 运行时完整职责

### 1. 配置加载

Pi Extension 启动时从当前 SQLite 数据库读取：

- Provider 基本配置。
- Provider API 协议。
- Provider baseUrl。
- Provider apiKey / authHeader / headers。
- Provider compat。
- Provider preset。
- Model 基本配置。
- Model API、baseUrl、headers、compat 覆盖。
- Model reasoning、thinkingLevelMap。
- Model input、contextWindow、maxTokens。
- Model cost、samplingParams。
- Model preset 和修改状态。
- 全局 hooks 设置。

仅加载 `enabled = 1` 的 Provider；Provider 旗下 Model 的有效配置按当前项目既定规则注册。

### 2. 有效配置合并

Provider 是默认配置源，Model 是局部覆盖源。

有效配置必须遵循：

```text
Model 显式值
  > Provider 继承值
    > 系统默认值
```

至少包含：

- API protocol。
- baseUrl。
- authHeader。
- headers。
- input。
- contextWindow。
- maxTokens。
- reasoning。
- thinkingLevelMap。
- cost。
- samplingParams。
- compat。
- preset / adapter policy。

Header 合并：

```text
{ ...provider.headers, ...model.headers }
```

Compat 合并：

```text
{ ...provider.compat, ...model.compat }
```

对于配置展示，继续使用当前 `resolveEffectiveModelConfig` 作为有效配置解释层，保证 Tauri 页面看到的配置和运行时注册使用的配置一致。

### 3. Pi Provider / Model 注册

运行时必须把有效配置转换为 Pi 能够识别的 Provider / Model 注册对象：

- Provider 以 Provider ID 注册。
- Provider 使用有效 baseUrl、api、apiKey、authHeader、headers。
- Model 使用自身覆盖后的 api、baseUrl、reasoning、input、contextWindow、maxTokens、cost、headers、samplingParams、compat。
- Provider compat 作为 Model compat 的基础值。
- 注册后建立 Provider + Model 到有效策略的索引。
- 数据库刷新时先清理已经不存在的 Provider，再重新构建索引和注册状态。

注册对象必须与桌面端有效配置预览语义一致，不能出现 Tauri 页面显示一套参数、Pi 实际注册另一套参数的问题。

### 4. hooks 运行职责

保留并明确以下 hooks：

#### `session_start`

- 重新从 SQLite 刷新 Provider / Model 快照。
- 重新注册 Provider / Model。
- 重建 adapter policy。
- 更新 Pi UI 状态。

#### `before_provider_request`

按当前 Provider + Model 找到有效策略后：

1. 读取 Model compat 和 Provider compat 的有效结果。
2. 执行通用 patch。
3. 执行对应 adapter 的 `beforeRequest`。
4. 允许 adapter 修改实际请求 payload。
5. 失败时保留明确错误上下文，不静默吞掉配置错误。

通用 patch 至少包含当前已经存在的 Responses reasoning `status` 清理逻辑，并继续扩展到配置声明的兼容行为。

#### `before_provider_headers`

- 根据全局设置决定是否注入 `x-session-id`。
- 执行 adapter 的 `beforeHeaders`。
- 应用 Provider 和 Model 的最终 header 策略。
- 避免重复注入或覆盖用户明确配置的关键 header，除非当前 adapter 明确要求覆盖。

#### `message_end`

- 根据全局设置识别各类上下文超长错误。
- 将非标准错误标准化为 Pi 能识别的 `context_length_exceeded`。
- 交给 Pi 现有的压缩和恢复机制。

### 5. adapter 运行职责

Adapter 不是 TUI 功能，而是 Provider / Model 运行时的一等职责。

Adapter 系统必须支持：

- 根据 Provider preset 选择 adapter。
- Provider 没有 adapter 时，根据 Model preset 选择 adapter。
- 建立可诊断的 adapter policy。
- 在请求前修改 payload。
- 在请求头阶段注入或修正 headers。
- 使用 `AdapterRequestContext` 获取 providerId、modelId、sessionId、cwd 和 ExtensionContext。
- 对 adapter 行为保留最少必要日志。

当前 Grok adapter 作为既有实现保留，并将其请求清洗和 conversation header 注入纳入运行时验证范围。

后续新增 adapter 必须遵循：

```text
AdapterDefinition
  -> registry 注册
    -> preset 映射
      -> factory 解析 policy
        -> runtime hooks 调用
```

不能在 `extension-runtime.ts` 中堆叠特定厂商的 if/else 逻辑。

### 6. 配置修改后的运行时一致性

Tauri 管理器保存 Provider 或 Model 后：

- SQLite 事务完成后才视为保存成功。
- 下次 Pi `session_start` 或 `/provider reload` 时读取最新配置。
- `/provider reload` 应重新加载 Provider、Model、有效配置和 adapter policy。
- 不允许出现 UI 已保存但运行时仍使用旧配置且没有刷新路径的情况。

由于 Extension 进程和 Tauri 进程是独立进程，本计划不引入复杂的实时跨进程推送；使用当前项目已经存在的数据库刷新与 `/provider reload` 机制保持边界清晰。

---

## 四、Tauri 管理器职责

### 1. 管理器定位

Tauri 管理器是复杂 Provider / Model 配置中心，不只是数据库 CRUD 页面。

它需要让开发者能够配置并验证 Pi Agent 实际会使用的运行参数：

- Provider。
- Model。
- API 协议。
- Endpoint。
- Key 和鉴权。
- Headers。
- Compat。
- Patch 相关字段。
- Hooks 全局策略。
- Adapter / preset 来源。
- Thinking 配置。
- 上下文和输出限制。
- Sampling 参数。
- 费率。
- Model family。
- 测试连接和测试请求。

### 2. 有效配置可见性

Tauri 页面必须能解释配置来源：

- 模型覆盖。
- 提供商继承。
- 默认回退。

对于容易影响运行的字段，应能看到最终有效值，而不是只看到原始输入值：

- api。
- baseUrl。
- headers。
- compat。
- thinkingLevelMap。
- samplingParams。
- adapter / preset。

### 3. 管理器与运行时的边界

Tauri 管理器负责：

- 配置录入。
- 配置校验。
- 数据库事务保存。
- 有效配置展示。
- 连接测试和测试运行。
- 备份和导出。

Pi Extension 负责：

- 读取数据库。
- 注册 Provider / Model。
- 解析运行时策略。
- 执行 hooks。
- 执行 adapter。
- 让 Pi Agent 真正使用这些配置。

TUI 负责：

- 选择当前已注册模型。
- 记录最近使用排序。

三者不应互相复制对方的职责。

---

## 五、实现模板和功能围栏

### 1. 推荐架构

```text
src/index.ts
  -> PiExtensionRuntime
      -> SQLite Snapshot Loader
      -> Effective Runtime Config
      -> Provider / Model Registration
      -> Adapter Policy Registry
      -> Request Hooks
      -> TUI Model Manager

src-tauri/src/service/db/mod.rs
  -> providers
  -> models
  -> app_meta
  -> preset / test runner

src/views/providers/
  -> Provider / Model 复杂配置页面

src/utils/effective-config.ts
  -> Provider + Model 有效配置解释器

src/adapters/
  -> adapter / patch / header hooks
```

### 2. TUI 模板

TUI 组件只通过运行时提供的回调和快照工作：

```ts
interface ModelManagerCallbacks {
  getData(): ModelManagerViewData;
  onSelect(providerId: string, modelId: string): Promise<void> | void;
  onCancel(): void;
}
```

TUI 不直接：

- 读数据库。
- 写数据库中的 Provider / Model。
- 注册 Provider。
- 执行 adapter。
- 改 hooks 设置。
- 改 compat 或 patch。

但这不表示插件只有选择器。运行时本身必须承担完整 Provider / Model 注入、hooks 和 adapter 职责。

### 3. 搜索实现模板

建议纯函数化：

```ts
interface OrderedMatchScore {
  matched: boolean;
  field: "model-id" | "model-name" | "family" | "provider-id" | "provider-name";
  fieldWeight: number;
  density: number;
  gaps: number;
  span: number;
  start: number;
}
```

评分行为：

- 用双指针查找查询字符的最优顺序匹配。
- 候选中允许跳过字符。
- 查询中不允许重排字符。
- 对同一字段可以寻找得分最高的一次匹配。
- 连续区间优先。
- 缺口越少优先。
- 起始位置越靠前优先。
- 字段权重决定模型字段优先于 Provider 字段。

### 4. 最近使用模板

最近使用属于模型选择辅助状态：

- 存在 `app_meta`。
- 不进入 Provider / Model schema。
- 不参与 Pi Provider 注册。
- 只影响 TUI 排序。
- 选择成功后更新。
- 读取异常回退为空。

### 5. 功能围栏

本次实现必须包含：

- 完整 Provider / Model 注册运行时。
- Provider / Model 有效配置合并。
- 当前已有 hooks 继续工作。
- 当前已有 adapter 继续工作。
- 三 Tab TUI。
- 有序字符搜索。
- 置信度排序。
- 最近使用记录。
- Tauri 复杂配置管理职责明确。
- SQLite 唯一配置来源。

本次实现不得引入：

- YAML 配置。
- 旧插件兼容层。
- 旧插件数据迁移。
- TUI 配置编辑器。
- TUI Provider / Model 开关。
- 与当前 adapter 体系平行的第二套 adapter 机制。
- 与当前有效配置解析器冲突的第二套继承规则。
- 无明确需求的实时跨进程同步系统。

---

## 六、测试边栏：有限测试

测试只覆盖高风险、跨模块和本次新增行为，不做过度测试。

### 1. 必须测试：搜索核心

覆盖：

- `g 6 l` 命中 `gpt-5.6-sol`。
- `g6l` 命中 `gpt-5.6-sol`。
- `gt56sol` 命中 `gpt-5.6-sol`。
- `sol` 命中对应字符顺序的候选。
- `g sol` 命中对应候选。
- `sol gpt` 不等价于 `gpt sol`。
- 查询字符缺失时不命中。
- 空查询返回全部候选。
- 大小写、空格、点号、短横线等分隔符归一化有效。
- 模型 ID 命中排序高于 Provider 名称命中。
- 连续命中排序高于分散命中。

### 2. 必须测试：模型管理器排序

覆盖：

- 默认 Tab 显示全部模型。
- 最近使用模型排在前面。
- 提供商 Tab 正确分组。
- 系列 Tab 正确分组。
- 无 family 模型进入 `Other`。
- 同分时保持稳定顺序。
- 当前模型可标记。

### 3. 必须测试：最近使用状态

覆盖：

- 模型选择成功后记录 providerId、modelId、usedAt。
- 重复选择同一模型不会无限增加重复项。
- 损坏或不存在的记录不会阻止 TUI 打开。
- 最近使用状态不会修改 Provider / Model 注册对象。

### 4. 必须测试：Provider / Model 运行时

只覆盖运行链路关键点：

- SQLite 中启用的 Provider 能注册。
- Model 的 `modelOverrides` 能覆盖 Provider 默认配置。
- Provider / Model 的 policy 索引能定位到正确模型。
- `before_provider_request` 能执行通用 patch 和对应 adapter。
- `before_provider_headers` 能执行全局 trace 和 adapter header 逻辑。
- `message_end` 能将约定的超长错误标准化。
- `/provider reload` 能重新加载数据库配置和 adapter policy。

### 5. 必须测试：Tauri 数据边界

只覆盖：

- Provider 和 Model 保存后仍能被 Extension 读取。
- `app_meta` 能保存和读取最近使用记录。
- Provider / Model 事务保存不会破坏关联数据。
- 有效配置展示结果与运行时合并规则一致。

### 6. 不做的测试

- 不测试旧 `custom-providers` 插件。
- 不测试 YAML 兼容和迁移。
- 不测试多用户、多租户或权限系统。
- 不做所有 Provider 字段的重复 CRUD 全覆盖。
- 不为每个兼容字段单独建立大规模测试矩阵。
- 不测试全部终端模拟器的键盘协议差异。
- 不新增与 TUI 无关的 Playwright 测试。
- 不做无数据规模依据的性能基准测试。

### 7. 验证命令

至少执行：

```bash
pnpm typecheck
pnpm build:ext
pnpm build:ui
```

如果补充了纯函数测试，执行对应测试命令；不为了测试而引入重量级测试框架。

---

## 七、具体实现措施和要点

### 1. 先统一“有效运行配置”来源

运行时注册和 Tauri 展示必须遵循同一套有效配置规则。

优先复用或抽取当前 `resolveEffectiveModelConfig` 中已经存在的继承逻辑，至少确保以下值不会出现两套解释：

- api。
- baseUrl。
- authHeader。
- headers。
- compat。
- samplingParams。
- thinkingLevelMap。
- contextWindow。
- maxTokens。
- preset / adapter。

如果 Extension 运行时与前端无法直接复用该函数，应在 TypeScript 侧抽取纯数据合并函数，使前端和 Extension 共享规则，而不是分别手写近似逻辑。

### 2. 完善 Extension 运行时

在 `PiExtensionRuntime` 中形成清晰的运行时生命周期：

```text
loadFromDb
  -> buildEffectiveProviders
    -> registerProviders
      -> buildPolicyIndex
        -> registerHooks
          -> exposeModelManager
```

重点措施：

- Provider 读取、Model 读取、settings 读取分离。
- 只在明确位置做 Provider / Model override 合并。
- 注册前得到完整有效配置。
- adapter policy 使用有效 Provider / Model。
- reload 时清理被删除 Provider。
- reload 时重建 policy index。
- 确保未注册 Provider 不残留旧 adapter policy。

### 3. 完善 Provider / Model hooks

将当前 hooks 分为两层：

#### 通用运行时 hooks

- header trace。
- Responses reasoning status 清理。
- overflow error 标准化。

#### Adapter hooks

- 特定 Provider / Model 的 payload 变换。
- 特定 Provider / Model 的 header 注入。
- 未来其他 vendor-specific 适配。

通用 hooks 和 adapter hooks 的执行顺序必须固定并记录在代码结构中，避免特定 adapter 绕过通用策略。

### 4. TUI 数据来源

TUI 需要从当前运行时快照读取：

- 当前已加载 Provider。
- 当前已注册 Model。
- 当前模型。
- Model family。
- Provider / Model 原始顺序。
- 最近使用状态。

TUI 不重新读取 `manager.db`，不直接访问 Tauri invoke，也不依赖桌面端运行。

### 5. 模型选择行为

Enter 选择成功后：

1. 调用当前 Pi Agent 的模型切换能力。
2. 只有切换成功后才记录最近使用。
3. 记录 Provider ID、Model ID、时间戳。
4. 关闭 TUI。
5. 失败时显示错误并保留选择器。

模型选择不得改变 Provider / Model 配置，也不得触发配置保存。

### 6. Tauri 配置管理

继续以当前 Tauri 页面为复杂配置中心：

- Provider 页面管理 Provider 基础字段和 Model 列表。
- Model Drawer 管理 Model 的协议、参数、兼容性、思考、采样和补丁相关配置。
- Effective config 页面展示最终值与来源。
- Preset 机制负责默认配置和 adapter 关联。
- Testing 页面验证实际请求链路。
- Settings 页面管理 trace、overflow recovery、主题、数据库和备份。

本次不把复杂字段搬到 TUI，也不因新增 TUI 而简化 Tauri 管理器。

### 7. 数据库和进程边界

- SQLite 是 Provider / Model / Settings 的唯一来源。
- Tauri 负责写入。
- Extension 只读加载运行配置。
- Extension 通过 reload 或 session_start 获取配置变更。
- 最近使用状态可以写入 app_meta，但应避免让模型选择状态影响配置事务。
- 不增加 YAML。
- 不实现旧插件文件监听。

### 8. 文档和命名同步

当前 README 仍有“读取 config.yaml”等过时表述，需要在实现完成时同步更新为：

- Extension 读取 `manager.db`。
- Tauri 管理器负责 SQLite 配置。
- Extension 负责注册、hooks 和 adapter。
- TUI 负责选择模型。

---

## 八、文件修改树和修改摘要

以下文件树按当前项目实际结构规划。新增文件只有在职责明确时创建；已有实现优先重构和复用。

```text
pi-modelprovider-manager/
├── README.md
│   修改摘要：修正项目架构说明，明确本项目是 Provider / Model 运行时插件，包含 SQLite 配置、Pi 注册、hooks、adapter、TUI 和 Tauri 管理器；删除过时的 config.yaml 描述。
│
├── src/
│   ├── index.ts
│   │   修改摘要：初始化完整 Pi Provider / Model 运行时；注册 /models 和 Alt+P 共用的 TUI 入口；保持 hooks、adapter、tools 和 provider reload 的统一生命周期。
│   │
│   ├── extension-runtime.ts
│   │   修改摘要：完善配置快照、有效配置构建、Provider / Model 注册、adapter policy 索引、hooks 执行、模型选择回调和最近使用状态；确保 reload 会清理旧 Provider 和旧 policy。
│   │
│   ├── types/
│   │   └── index.ts
│   │       修改摘要：补充运行时有效配置、模型管理器展示项、最近使用记录及必要回调类型；不破坏现有 ProviderSchema、ModelSchema 和 AppSettings。
│   │
│   ├── adapters/
│   │   ├── types.ts
│   │   │   修改摘要：明确 adapter policy、请求上下文和 hook 生命周期类型；必要时补充通用 patch 与 header hook 的类型边界。
│   │   │
│   │   ├── factory.ts
│   │   │   修改摘要：统一 Provider preset 优先、Model preset 回退的 adapter policy 解析；保证有效配置和 adapter 选择使用同一规则。
│   │   │
│   │   ├── registry.ts
│   │   │   修改摘要：保持 adapter 注册表为唯一扩展点；补充 preset 映射的稳定性和未知 preset 的可诊断处理。
│   │   │
│   │   ├── grok.ts
│   │   │   修改摘要：保留并整理 Grok payload/header hooks，使其继续通过统一 runtime policy 调用。
│   │   │
│   │   └── grok-core.ts
│   │       修改摘要：仅在运行链路验证发现需要时修正具体 payload 清洗逻辑，不改变其 vendor-specific 职责边界。
│   │
│   ├── model-manager/
│   │   ├── model-manager-ui.ts
│   │   │   修改摘要：新增或实现三 Tab TUI；保留 Emoji；实现即时搜索、上下移动、Tab 切换、Enter 选择、Esc 关闭和分组渲染；完全移除配置控制菜单。
│   │   │
│   │   ├── model-manager-search.ts
│   │   │   修改摘要：实现大小写/分隔符归一化、有序字符匹配、最优匹配位置计算和置信度评分；不做分词语义匹配和查询字符重排。
│   │   │
│   │   ├── model-manager-sort.ts
│   │   │   修改摘要：实现默认、提供商、系列三种视图的过滤、分组和稳定排序；合并字段匹配优先级、最近使用时间和数据库顺序。
│   │   │
│   │   └── model-manager-types.ts
│   │       修改摘要：定义 TUI 快照、展示项、分组项、评分、最近使用和组件回调类型。
│   │
│   ├── utils/
│   │   ├── effective-config.ts
│   │   │   修改摘要：作为 Provider / Model 有效配置的权威合并规则；必要时抽取可供 Extension runtime 复用的纯函数，确保 Tauri 展示值与 Pi 注册值一致。
│   │   │
│   │   ├── sqlite-storage.ts
│   │   │   修改摘要：增加最近使用状态的读取和保存封装；继续使用当前 app_meta SQLite 接口，不读取旧插件文件。
│   │   │
│   │   ├── model-manager-recent.ts
│   │   │   修改摘要：新增最近使用记录的去重、截断、容错和排序辅助逻辑；不参与 Provider / Model 配置注册。
│   │   │
│   │   └── storage.ts
│   │       修改摘要：如有必要补充当前 SQLite 状态 key 常量；不重新引入 YAML 路径或 YAML 读写。
│   │
│   ├── stores/
│   │   ├── provider.ts
│   │   │   修改摘要：保持 Provider / Model 的 Pinia 业务状态与 SQLite CRUD；必要时补充有效配置刷新或最近使用状态消费，但不把 TUI 状态混入 Provider 实体。
│   │   │
│   │   ├── settings.ts
│   │   │   修改摘要：继续管理 trace、overflow recovery、theme 等全局运行时设置；如增加 TUI 相关偏好，必须与 AppSettings 明确区分。
│   │   │
│   │   └── testing.ts
│   │       修改摘要：确保测试工作台调用的有效配置、adapter policy 和实际运行时规则一致；只修正必要的配置链路偏差。
│   │
│   ├── views/
│   │   ├── providers/
│   │   │   修改摘要：保留 Provider / Model 复杂管理职责；补齐或调整有效配置、compat、patch、preset、adapter 来源的可视化，不引入 TUI 选择交互。
│   │   │
│   │   ├── settings/
│   │   │   修改摘要：明确展示 SQLite、trace、overflow recovery 和运行时相关全局设置；同步最新架构文案。
│   │   │
│   │   └── testing/
│   │       修改摘要：继续用于连接和请求链路验证；必要时展示实际生效的 adapter、hooks 和有效模型配置。
│   │
│   └── tests/
│       ├── model-manager-search.test.ts
│       │   修改摘要：有限覆盖搜索归一化、有序字符匹配、查询顺序和置信度排序。
│       │
│       ├── model-manager-sort.test.ts
│       │   修改摘要：有限覆盖三个 Tab 的分组、最近使用和稳定排序。
│       │
│       └── runtime-config.test.ts
│           修改摘要：有限覆盖 Provider/Model override 合并、adapter policy 选择和关键 hooks 的运行前提；不做全字段矩阵测试。
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   │   修改摘要：保持 SQLite、preset、testing 等 command 注册完整；如需要最近使用专用 command，仅在 app_meta 现有接口无法满足时增加。
│   │   │
│   │   └── service/
│   │       ├── db/
│   │       │   └── mod.rs
│   │       │       修改摘要：保持 providers/models/app_meta 的 SQLite schema 和事务行为；支持最近使用状态保存；不修改 Provider/Model 核心字段结构，除非运行时缺少明确必需字段。
│   │       │
│   │       ├── preset/
│   │       │   修改摘要：保持官方 Provider/Model 预设加载和 adapter 关联来源；确保预设信息能被管理器有效展示并由 Extension 正确解析。
│   │       │
│   │       └── test_runner/
│   │           修改摘要：保持测试 Agent 的配置注入与当前数据库一致；必要时修正测试环境没有使用有效 compat/adapter/hooks 的问题。
│   │
│   └── Cargo.toml
│       修改摘要：只有 Rust 侧确实需要新增依赖时修改；优先复用现有 rusqlite、serde、Tauri 依赖。
│
├── package.json
│   修改摘要：保留现有 extension、UI、Tauri 构建脚本；增加 `assemble:plugin`，使完整构建最终输出标准插件单元目录。
│
├── scripts/
│   └── assemble-plugin.mjs
│       修改摘要：将 Extension、UI、Tauri binary、README 和 package 元数据组装到 `dist/pi-modelprovider-manager/`。
│
└── plan/
    └── 模型管理器TUI实现计划.md
        修改摘要：本文件，记录完整产品边界、运行时职责、TUI 规格、Tauri 管理器职责、hooks/adapter 链路、测试边栏和文件修改树。
```

### 文件修改原则

- 不因为计划列出了文件就强行修改所有文件。
- 优先复用已有 `extension-runtime.ts`、`effective-config.ts`、`sqlite-storage.ts`、`app_meta` 和 adapter 体系。
- 如果现有 `app_meta_load/app_meta_save` 已经足够，不新增 Rust command。
- 如果 Extension 和前端无法共享有效配置函数，应抽取纯函数，而不是复制两套继承规则。
- 不把旧插件的 `model-manager-ui.ts` 直接复制进当前项目；只按当前类型和当前运行时回调重新实现。
- 不修改无关的 Vue 页面和数据库字段。

---

## 九、桌面管理器命令与发布单元

### 1. `model-manager` 命令

在 Pi Extension 中增加：

```text
/model-manager
```

命令职责：

- 定位当前插件安装目录下的 `bin/pi-modelprovider-manager` 可执行文件。
- 启动 Tauri Provider / Model 管理器。
- 找不到 binary 时提示先完成完整构建。
- 不直接实现 Tauri 配置 UI。
- 不改变当前 `/models` 模型选择器的职责。

### 2. Tauri 管理器单实例

全局只允许一个 Tauri 管理器进程/窗口：

- 使用 Tauri single-instance 插件，替代易残留的锁文件。
- 重复启动时恢复已有窗口并聚焦，不永久置顶。
- 开发、生产使用不同应用标识，各环境最多一个窗口。
- 开发数据（包括模板）放在 `dev-cache/`；生产继续使用原路径。`pnpm dev` 自动设置 `PI_MODEL_MANAGER_ENV=development`，Extension 默认生产，显式环境变量可切换。
- Tauri 的窗口设置继续只保留一个主窗口。
- Pi 中重复执行 `/model-manager` 不会产生第二个管理器进程。

该管理器不需要常驻后台；关闭窗口即结束进程，下一次命令重新启动即可。

### 3. 标准插件使用单元

完整构建的最终使用单位固定为：

```text
dist/pi-modelprovider-manager/
├── index.js
├── index.d.ts
├── index.js.map
├── package.json
├── README.md
├── bin/
│   └── pi-modelprovider-manager.exe
└── ui/
    ├── index.html
    └── assets/
```

构建流程：

```text
pnpm clean
  -> pnpm build:ext
  -> pnpm build:tauri
  -> pnpm assemble:plugin
  -> dist/pi-modelprovider-manager/
```

Extension 运行时从自身目录相对定位 `bin`，不依赖当前工作目录；开发环境额外支持项目 `dist/bin` 回退路径。

### 4. 发布边界

- `dist/pi-modelprovider-manager` 是未来交付和安装到 Pi 的标准插件目录。
- `index.js` 是 Pi Agent Extension 入口。
- `bin` 是 `/model-manager` 命令启动的 Tauri 管理器。
- `ui` 是 Tauri 的静态前端资源。
- 不要求用户额外安装全局 Tauri 或 Node 环境来打开已构建管理器。
- 构建脚本负责把 Extension、UI、binary 组装到同一个目录。

## 十、完成判定

### 运行时主链路

1. Tauri 保存的 Provider / Model 配置进入当前 SQLite。
2. Pi Extension 能从同一个 SQLite 读取配置。
3. Provider / Model 能以有效配置注册到 Pi Agent。
4. Model override、Provider compat、Model compat 正确生效。
5. hooks 能在请求前、请求头阶段和消息结束阶段执行。
6. adapter 能根据 preset 正确执行 payload 和 header 适配。
7. `/provider reload` 能重新加载配置、注册和 policy。
8. Tauri 测试工作台与实际运行时使用一致的有效配置逻辑。

### TUI

1. `/models` 和 `Alt+P` 打开同一个 TUI。
2. 只有默认、提供商、系列三个 Tab。
3. 默认 Tab 显示全部模型并按使用顺序排列。
4. 搜索支持有序字符匹配、分隔符归一化和置信度排序。
5. 查询顺序不同不会错误视为等价。
6. Provider / Series 视图能正确分组。
7. Enter 选择后当前 Pi 模型发生切换。
8. 成功选择后最近使用记录保存到当前 SQLite。
9. TUI 不执行 Provider / Model 配置修改。
10. TUI 继续使用 Emoji。

### 产品边界

1. Tauri 是复杂 Provider / Model 管理器。
2. Pi Extension 是实际运行时 Provider / Model 插件。
3. Adapter 和 hooks 是运行时核心职责，不是可选附属功能。
4. TUI 是快速选择器，不是配置编辑器。
5. SQLite 是唯一配置来源。
6. 不读取、不迁移、不兼容旧 `providers` 插件数据。
7. 不重新引入 YAML。

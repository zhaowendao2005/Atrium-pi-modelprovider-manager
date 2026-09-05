import type { FieldDoc } from "./fieldDocs";

/**
 * Pi Agent 官方兼容性矩阵 (Compat) 深度文档与排错通俗解析
 */
export const compatDocsMap: Record<string, FieldDoc> = {
  // === 兼容性矩阵总览机制 ===
  compatMatrixOverview: {
    id: "compatMatrixOverview",
    name: "Pi Agent 兼容性适配矩阵 (Model Compat)",
    field: "compatMatrixOverview",
    category: "compat",
    description: "消除主流官方大模型（OpenAI, Anthropic, DeepSeek, 智谱, 通义千问等）与第三方中转代理、开源推理引擎（vLLM, SGLang, Ollama）之间的底层通信协议与校验差异。",
    details: `大模型 API 就像不同国家的充电插头：虽然大家都叫“Chat Completions”，但各家厂商在细节上有各自的“方言”。比如有的厂商要求最大输出叫 max_tokens，有的必须叫 max_completion_tokens；有的厂商只认 system 角色，遇到 OpenAI 新出的 developer 角色就会直接报错崩溃。

Pi 内置了自动“转接头”（即这里的兼容性矩阵）。当你配置第三方中转或开源模型时，通过调整开关，Pi 会在上游网络请求发送前把数据转换成该端点支持的格式。

1. 思考流协议适配 (thinkingFormat)
• DeepSeek: 自动解析 reasoning_content 字段与专属 SSE 思考流
• 智谱 GLM (zai): 请求体自动注入 thinking: { type: 'enabled', clear_thinking: false }
• 通义千问 (qwen / qwen-chat-template): 自动注入 enable_thinking: true 与 preserve_thinking: true
• OpenRouter: 统一封装成 reasoning: { effort } 结构
• 开源私有引擎: 动态注入 chat_template_args / chat_template_kwargs

2. Token 字段智能重定向 (maxTokensField)
• OpenAI o1/o3/GPT-4o 强制要求 max_completion_tokens，传统中转回退为 max_tokens

3. 角色自动降级容错 (supportsDeveloperRole)
• 将 developer 消息角色无缝转译为通用的 system 角色，消除 400 校验异常

4. 工具调用严格修补 (Tool Call Patches)
• 严格交替补位 (requiresAssistantAfterToolResult): 修复国产模型 User->Assistant->Tool->Assistant 的死板次序要求
• 工具 Name 必填 (requiresToolResultName): 为工具结果自动补齐 tool_name
• 空签名放行 (allowEmptySignature): 允许第三方 Claude 代理剥离签名后的正常回放
• 严格模式 (supportsStrictTools): 在工具参数中强制注入 strict: true`,
    impact: "一站式解决中转站 400 Bad Request、思考链混入回答正文、多轮工具调用直接中断等所有协议水土不服问题。",
    defaultValue: "模型级留空即自动继承提供商全局 Compat 配置",
  },

  // === 细粒度特性开关 ===

  supportsDeveloperRole: {
    id: "supportsDeveloperRole",
    name: "支持 Developer 角色 (supportsDeveloperRole)",
    field: "supportsDeveloperRole",
    category: "compat",
    description: "是否允许在对话消息列表中使用 OpenAI 新版推理模型专用的 'developer' 角色。",
    details: `传统的聊天模型只有三种人说话：system（系统设定）、user（用户）、assistant（模型）。OpenAI 推出 o1/o3 推理模型后，推出了新的 "developer" 角色取代 system 角色来注入高优先级指令。

许多第三方中转站或开源模型（如 vLLM）只认标准的 user/assistant/system。一旦在请求体 messages 数组里发现 { "role": "developer" }，立刻会报错：400 Bad Request: role must be one of user, assistant, system。

开启 (true):
{ "messages": [{ "role": "developer", "content": "You are a helpful coder..." }] }

关闭 (false):
Pi 在发往网关前会自动替换为：
{ "messages": [{ "role": "system", "content": "You are a helpful coder..." }] }`,
    impact: "设为 false 可彻底解决中转站报 developer 角色未定义的 400 报错。",
    defaultValue: "继承提供商 (默认 true)",
  },

  supportsReasoningEffort: {
    id: "supportsReasoningEffort",
    name: "Reasoning Effort 思考强度参数 (supportsReasoningEffort)",
    field: "supportsReasoningEffort",
    category: "compat",
    description: "是否在发往模型的请求体根层级携带 'reasoning_effort'（low/medium/high）参数。",
    details: `这是控制模型“花多大精力去深度思考”的参数。官方 OpenAI o1/o3 和部分 DeepSeek-R1 中转支持接收 low, medium, high。

一些中转站使用的网关程序较为老旧，对未识别的参数非常敏感。只要请求体里带了 "reasoning_effort": "high"，就会拒绝服务并报错：400 Bad Request: Extra inputs are not permitted 或 Unrecognized request argument: reasoning_effort。

开启 (true):
{ "model": "o3-mini", "reasoning_effort": "medium", "messages": [...] }

关闭 (false):
{ "model": "o3-mini", "messages": [...] }（Pi 将剥离该字段避免产生参数校验报错）`,
    impact: "如果遇到中转站报 reasoning_effort 参数不合法，设为 false 即可恢复正常。",
    defaultValue: "继承提供商",
  },

  forceAdaptiveThinking: {
    id: "forceAdaptiveThinking",
    name: "自适应思考协议 (forceAdaptiveThinking)",
    field: "forceAdaptiveThinking",
    category: "compat",
    description: "强制启用 Claude 3.7 Sonnet 专用的自适应思考（Adaptive Thinking）协议。",
    details: `Anthropic 在 Claude 3.7 中引入了两种思考控制模式：
1. 固定 Token 预算模式（指定最多思考 4000 个 Token）；
2. 自适应模式（Adaptive）：模型根据问题的复杂程度自己决定思考多少步。

开启后，Pi 向上游 Anthropic /messages 接口发送请求体时，会使用：
{
  "thinking": { "type": "adaptive" },
  "output_config": { "effort": "medium" }
}
而不是传统的固定预算 budget_tokens。`,
    impact: "让 Claude 3.7 动态决定思考深度，兼顾极速响应与深度推理。",
    defaultValue: "继承提供商 (默认 false)",
  },

  allowEmptySignature: {
    id: "allowEmptySignature",
    name: "允许空思考签名 (allowEmptySignature)",
    field: "allowEmptySignature",
    category: "compat",
    description: "当回放多轮对话历史时，允许 Anthropic 思考块中的 signature 字段为空字符串。",
    details: `Anthropic 官方规定：Claude 输出思考过程时会生成一个不可篡改的加密数字签名（signature: "xxx"）。在第二轮对话把历史发回时，Anthropic 必须验证这个签名以确保思考过程没有被伪造。

很多第三方中转站为了节省带宽或出于隐私过滤，把返回的 signature 字段删掉了或者填了空字符串 ""。下一轮请求如果按照官方标准回传，第三方校验器就会报错崩溃。

开启后，Pi 会在回放对话历史时绕过对 signature 的严格非空检查，将空签名正常序列化发出：
{
  "role": "assistant",
  "content": [
    { "type": "thinking", "thinking": "Let me see...", "signature": "" }
  ]
}`,
    impact: "解决使用第三方 Claude 中转站多轮对话时报 'invalid thinking signature' 的问题。",
    defaultValue: "继承提供商",
  },

  supportsExplicitPromptCacheMode: {
    id: "supportsExplicitPromptCacheMode",
    name: "显式提示词缓存 (supportsExplicitPromptCacheMode)",
    field: "supportsExplicitPromptCacheMode",
    category: "compat",
    description: "声明是否启用针对新一代大模型的显式 Prompt Cache（提示词缓存）控制标记。",
    details: `Agent 的系统提示词和工具列表往往非常长（数万 Token）。开启缓存后，只有第一次发请求收全价，后续对话命中缓存只要 1/10 的极低价格。

针对支持显式标记的端点，Pi 会在请求体的系统提示词或工具列表末尾注入特殊的缓存标记：
{
  "messages": [
    { "role": "system", "content": "Long Prompt...", "cache_control": { "type": "ephemeral" } }
  ]
}`,
    impact: "大幅降低多轮长上下文对话的 Token 费用并极大加快首字响应速度。",
    defaultValue: "继承提供商",
  },

  supportsAdditionalTools: {
    id: "supportsAdditionalTools",
    name: "扩展附加工具 (supportsAdditionalTools)",
    field: "supportsAdditionalTools",
    category: "compat",
    description: "控制是否向模型声明并挂载运行时扩展动态注入的附加工具能力。",
    details: `Pi 拥有非常强大的扩展生态（如自定义脚本、MCP 外部工具等）。开启该项后，Pi 会在每一次请求的 tools 字段中打包注入所有附加工具定义：
{
  "tools": [
    { "type": "function", "function": { "name": "read", ... } },
    { "type": "function", "function": { "name": "mcp_custom_tool", ... } }
  ]
}`,
    defaultValue: "继承提供商",
  },

  supportsToolSearch: {
    id: "supportsToolSearch",
    name: "内置工具动态搜索 (supportsToolSearch)",
    field: "supportsToolSearch",
    category: "compat",
    description: "是否启用智能体在面对上百个海量工具时的动态检索与按需载入能力。",
    details: `当你的 Pi 接入了几十个 MCP 插件、有上百个工具时，把所有工具定义一次性全塞给大模型会把上下文撑爆、耗尽费用，且模型容易被干扰。
开启此项后，Pi 会使用工具搜索（Tool Search）协议，只有当模型提出需要某类能力时才把具体工具参数暴露给模型。`,
    defaultValue: "继承提供商",
  },

  requiresToolResultName: {
    id: "requiresToolResultName",
    name: "工具返回必须含 Name (requiresToolResultName)",
    field: "requiresToolResultName",
    category: "compat",
    description: "在向模型回传工具执行结果（tool_result）时，是否必须显式强制附带 'name' 属性。",
    details: `标准 OpenAI 规范中，回传工具结果只需要注明 tool_call_id 和 content（即结果文本）。
但是一些国产大模型（如旧版通义千问、百川、商汤等）和定制推理后端实现不够规范，它们必须在每条工具结果里看到该工具的名字，否则就会报错 "missing field: name"。

开启 (true):
{
  "role": "tool",
  "tool_call_id": "call_123",
  "name": "bash",
  "content": "command output..."
}

标准 OpenAI:
{
  "role": "tool",
  "tool_call_id": "call_123",
  "content": "command output..."
}`,
    impact: "解决国产模型在调用完工具回传结果时突然报错 400 的问题。",
    defaultValue: "继承提供商",
  },

  requiresAssistantAfterToolResult: {
    id: "requiresAssistantAfterToolResult",
    name: "工具后跟随 Assistant (requiresAssistantAfterToolResult)",
    field: "requiresAssistantAfterToolResult",
    category: "compat",
    description: "在回传工具结果后，是否强制插入一条 Assistant 占位消息以满足严格交替轮次规则。",
    details: `OpenAI 允许连续多条 tool 消息，也可以在 tool 后面紧跟 user 提问。
但部分极其死板的模型后端（如某些 GLM / 开源微调模型）要求消息列表必须严格像乒乓球一样轮流：User 问 -> Assistant 调工具 -> Tool 返回结果 -> 必须立刻有 Assistant 说话，绝不允许角色顺序乱序。

开启后，Pi 在检测到工具执行完毕后，如果发现模型架构需要严格交替，会自动在 messages 数组后无感追加一条占位的 assistant 确认消息，防止后端抛出 "Chat history format error: alternating roles required"。`,
    impact: "彻底治愈各种国产/开源模型报“消息角色顺序不符合规范”的顽疾。",
    defaultValue: "继承提供商",
  },

  requiresReasoningContentOnAssistantMessages: {
    id: "requiresReasoningContentOnAssistantMessages",
    name: "Assistant 含推理字段 (requiresReasoningContentOnAssistantMessages)",
    field: "requiresReasoningContentOnAssistantMessages",
    category: "compat",
    description: "在向 DeepSeek-R1 类兼容网关回放助手历史消息时，强制附带 reasoning_content 字段（哪怕为空串）。",
    details: `DeepSeek-R1 类推理模型返回的消息包含两个部分：reasoning_content（思考过程）和 content（正文）。
很多兼容 DeepSeek 的中转网关在第二轮对话校验历史时，要求 messages 里的每一条 role: "assistant" 对象都必须具备 reasoning_content 键，哪怕没有思考也必须写成 ""，缺少该键就会报 400 Bad Request。

开启后 Pi 构造的请求体：
{
  "role": "assistant",
  "content": "Hello world",
  "reasoning_content": ""
}`,
    impact: "修复各类 DeepSeek-R1 兼容中转站在多轮对话回放时报缺少 reasoning_content 的问题。",
    defaultValue: "继承提供商",
  },

  requiresThinkingAsText: {
    id: "requiresThinkingAsText",
    name: "思考内容转文本 (requiresThinkingAsText)",
    field: "requiresThinkingAsText",
    category: "compat",
    description: "将模型的思维链（Thinking Block）直接包裹在 <think> 标签内合并到正文纯文本中，而不是使用独立对象字段传递。",
    details: `像 Claude 和 OpenAI Responses 协议，思考过程是作为独立的高级结构体（Thinking Block）存在的。
但开源模型（如 DeepSeek-R1-Distill、Qwen-QwQ、Ollama）通常只是在普通的文本里输出 <think>思考过程...</think>。

开启后，Pi 会将结构化的思考块打平成带有 <think> 标签的普通字符串拼接在 content 里，让普通的聊天模型和开源端点也能完美理解之前的思考上下文。`,
    defaultValue: "继承提供商",
  },

  supportsEagerToolInputStreaming: {
    id: "supportsEagerToolInputStreaming",
    name: "工具即时流式解析 (supportsEagerToolInputStreaming)",
    field: "supportsEagerToolInputStreaming",
    category: "compat",
    description: "在模型生成工具调用参数（JSON）的过程中，是否以最高速度实时流式推入解析器。",
    details: `当模型要执行工具（比如写一段 500 行代码到文件）时，上游是逐字吐出 JSON 字符的。
• 开启 (默认)：Pi 一边接收一边流式预解析参数，终端能以最快速度渲染出正在调用的命令，体验极度顺滑。
• 关闭：如果某些中转站的 SSE 流式分片非常诡异导致 JSON 解析频繁出错，设为 false 会让 Pi 在收全整个工具调用数据包后再一次性解析执行。`,
    defaultValue: "继承提供商 (默认 true)",
  },

  supportsLongCacheRetention: {
    id: "supportsLongCacheRetention",
    name: "1 小时长缓存 (supportsLongCacheRetention)",
    field: "supportsLongCacheRetention",
    category: "compat",
    description: "在 Anthropic 兼容端点的 cache_control 标记中注入 ttl: '1h'，将提示词缓存保留时间延长至 1 小时。",
    details: `Anthropic 原生的 Prompt Cache 默认保留时长通常只有 5 分钟。如果写代码中途查资料超过 5 分钟，下次提问就必须重新支付全额缓存写入费。
开启此项且上游端点支持长缓存时，Pi 会在请求头和 cache_control 声明 1 小时生命周期（ttl: 1h），长期保持低成本高速响应。`,
    impact: "在中长会话中极大减少重复缓存写入的费用支出。",
    defaultValue: "关闭 (false)",
  },

  supportsStrictTools: {
    id: "supportsStrictTools",
    name: "严格工具模式 (supportsStrictTools)",
    field: "supportsStrictTools",
    category: "compat",
    description: "在向模型发送 tools 定义时，显式注入 strict: true 开启结构化输出（Structured Outputs）。",
    details: `大模型调用工具时偶尔会“脑抽”，少填一个必填参数或者把数字写成字符串。
OpenAI 推出的 Strict 模式强制模型在底层解码时 100% 遵循你给的 JSON Schema 结构，杜绝一切格式错误。

开启后的请求体结构：
{
  "tools": [{
    "type": "function",
    "function": {
      "name": "edit",
      "strict": true,
      "parameters": { ... }
    }
  }]
}`,
    impact: "极大降低工具调用参数畸形率，但在不支持 strict 的中转端点上可能会报 400，需根据提供商支持情况开关。",
    defaultValue: "继承提供商",
  },

  supportsToolReferences: {
    id: "supportsToolReferences",
    name: "动态工具延迟引用 (supportsToolReferences)",
    field: "supportsToolReferences",
    category: "compat",
    description: "支持 Claude 原生的动态延迟工具引用机制（Deferred Tools）。",
    details: `在超长代码库或复杂 Agent 工作流中，将暂未激活的工具以延迟引用（References）的方式放入上下文，在不消耗大量 Token 空间的同时保留智能体随时唤醒工具的能力。`,
    defaultValue: "继承提供商",
  },

  thinkingFormat: {
    id: "thinkingFormat",
    name: "思考链传递格式 (thinkingFormat)",
    field: "thinkingFormat",
    category: "compat",
    description: "指定思考模型向该提供商网关发送请求时，采用的参数载荷格式。",
    details: `• openai: 默认使用 reasoning_effort (low/medium/high)
• deepseek: 注入 thinking: { type: 'enabled' } 参数，并接收 reasoning_content 流
• zai: 针对智谱 GLM 模型，注入 thinking 模式并支持 clear_thinking 参数
• qwen: 针对通义千问，注入 enable_thinking: true 参数
• openrouter: 使用 OpenRouter 专用的 reasoning: { effort } 结构
• chat-template / baseten: 将思考参数注入到 chat_template_kwargs / chat_template_args 中`,
    example: "deepseek 或 zai",
    defaultValue: "继承提供商",
  },

  maxTokensField: {
    id: "maxTokensField",
    name: "最大 Token 字段名 (maxTokensField)",
    field: "maxTokensField",
    category: "compat",
    description: "向上游发送最大输出限制时采用的字段名称（max_tokens vs max_completion_tokens）。",
    details: `• max_tokens: 传统 OpenAI Chat Completions 协议字段
• max_completion_tokens: OpenAI o1/o3 及 GPT-4o 新版 API 强制要求的字段名称
如果中转站报 'unsupported parameter: max_tokens'，切换为 max_completion_tokens 即可解决。`,
    example: "max_completion_tokens 或 max_tokens",
    defaultValue: "继承提供商",
  },

  thinkingTokenBudgetField: {
    id: "thinkingTokenBudgetField",
    name: "思考预算字段 (thinkingTokenBudgetField)",
    field: "thinkingTokenBudgetField",
    category: "compat",
    description: "向中转站传递思考预算限制时使用的字段名（如 thinking_budget 或 thinking_token_budget）。",
    defaultValue: "继承提供商",
  },
};

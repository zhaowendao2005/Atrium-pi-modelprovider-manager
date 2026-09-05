import { compatDocsMap } from "./compatDocs";
import { adaptationDocsMap } from "./adaptationDocs";

export interface FieldDoc {
  id: string;
  name: string;
  field: string;
  category: "basic" | "protocol" | "limits" | "sampling" | "compat" | "adaptation";
  description: string;
  details?: string;
  example?: string;
  defaultValue?: string;
  impact?: string;
}

/**
 * 模型与提供商配置字段基础文档字典
 */
export const baseFieldDocs: Record<string, FieldDoc> = {
  // === 基础配置 (Basic) ===
  id: {
    id: "id",
    name: "模型 ID (Model ID)",
    field: "id",
    category: "basic",
    description: "传递给上游 API 接口的模型唯一标识符（例如 deepseek-chat, gpt-4o, claude-3-7-sonnet-20250219）。",
    example: "deepseek-chat 或 gpt-4o",
    impact: "必须与提供商 API 支持的模型名称完全一致，否则上游将返回 404 或 Model Not Found 错误。",
  },
  name: {
    id: "name",
    name: "显示名称 (Display Name)",
    field: "name",
    category: "basic",
    description: "在 Pi 界面、模型选择器与状态栏中展示的人类可读名称。",
    example: "DeepSeek V3 (官方) 或 GPT-4o Omni",
    defaultValue: "默认同 Model ID",
  },
  baseUrl: {
    id: "baseUrl",
    name: "接口地址 (Base URL)",
    field: "baseUrl",
    category: "basic",
    description: "大模型上游 API 请求端点的基础路径。",
    example: "https://api.deepseek.com/v1 或 https://api.openai.com/v1",
    impact: "如果留空，默认使用该提供商的 Base URL；填写则支持该模型走独立代理或中转端点。",
  },
  api: {
    id: "api",
    name: "通信协议 (API Protocol)",
    field: "api",
    category: "protocol",
    description: "与大模型服务端交互时遵循的网络与数据协议规范。",
    details: `• openai-completions: 标准 OpenAI /chat/completions 协议 (支持大多数开源中转及国产模型)
• openai-responses: OpenAI 新版 Responses API (/responses 终结点，支持 o1/o3 思考流)
• anthropic-messages: Anthropic /messages 协议 (支持 Claude 系列及原生长上下文缓存)
• google-generative-ai: Google Gemini 原生协议
• mistral-conversations: Mistral 原生对话协议`,
    impact: "协议类型决定了 Payload 结构、SSE 响应解析机制以及工具调用的通信逻辑。",
  },
  apiKey: {
    id: "apiKey",
    name: "模型专属 API Key",
    field: "apiKey",
    category: "basic",
    description: "针对当前模型单独配置的访问凭证。留空则自动继承提供商全局配置的 API Key。",
    defaultValue: "继承提供商全局 API Key",
  },

  // === 上下文与限制 (Limits) ===
  contextTokens: {
    id: "contextTokens",
    name: "上下文窗口 (Context Window)",
    field: "contextTokens",
    category: "limits",
    description: "模型支持的最大总 Token 数（包含用户输入、系统提示词、工具定义以及历史会话）。",
    details: "当会话接近该上限时，Pi 会触发上下文压缩或裁剪，防止请求被上游网关截断。",
    example: "131072 (128K) 或 1048576 (1M)",
  },
  maxTokens: {
    id: "maxTokens",
    name: "最大生成 Token (Max Output Tokens)",
    field: "maxTokens",
    category: "limits",
    description: "单次推理请求中模型允许生成的最大 Token 数量。",
    details: "如未指定，Pi 将使用全局默认值或不发送硬性限制。",
    example: "4096, 8192, 16384",
  },

  // === 采样参数 (Sampling) ===
  temperature: {
    id: "temperature",
    name: "采样温度 (Temperature)",
    field: "temperature",
    category: "sampling",
    description: "控制生成结果的随机性与创造力。值越低回答越严谨确定，值越高越发散发散多样。",
    details: "• 0.0 ~ 0.3: 适合严谨的代码生成、数据提取与数学逻辑\n• 0.7: 适合通用编程与综合问答\n• 1.0+: 适合头脑风暴与创意写作",
    defaultValue: "继承全局默认值 (通常 0.7)",
  },
  topP: {
    id: "topP",
    name: "核采样 (Top P)",
    field: "topP",
    category: "sampling",
    description: "通过累积概率截断词表采样范围。通常建议与 Temperature 二选一微调。",
    example: "0.95",
  },
  frequencyPenalty: {
    id: "frequencyPenalty",
    name: "频率惩罚 (Frequency Penalty)",
    field: "frequencyPenalty",
    category: "sampling",
    description: "根据词语在文本中已出现的频率对其进行惩罚，降低生成重复用词的概率。",
    example: "0.0",
  },
  presencePenalty: {
    id: "presencePenalty",
    name: "存在惩罚 (Presence Penalty)",
    field: "presencePenalty",
    category: "sampling",
    description: "只要词语在文本中出现过即施加惩罚，鼓励模型引入全新的主题与讨论。",
    example: "0.0",
  },
};

/**
 * 汇总全量文档字典（基础 + 兼容性矩阵 + 中转补丁）
 */
export const fieldDocsMap: Record<string, FieldDoc> = {
  ...baseFieldDocs,
  ...compatDocsMap,
  ...adaptationDocsMap,
};

/**
 * 获取字段文档
 */
export function getFieldDoc(fieldId: string): FieldDoc | undefined {
  return fieldDocsMap[fieldId];
}

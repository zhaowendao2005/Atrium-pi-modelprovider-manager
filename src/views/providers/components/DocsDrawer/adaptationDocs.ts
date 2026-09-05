import type { FieldDoc } from "./fieldDocs";

/**
 * 请求修复与第三方中转适配补丁 (Adaptation Patches) 文档
 */
export const adaptationDocsMap: Record<string, FieldDoc> = {
  // === 补丁大类总览 ===
  adaptationPatchesOverview: {
    id: "adaptationPatchesOverview",
    name: "请求修复与第三方中转适配补丁机制",
    field: "adaptationPatchesOverview",
    category: "adaptation",
    description: "针对第三方聚合中转站、开源网关与非标代理后端的请求协议修复与数据清洗补丁。",
    details: `【中转适配补丁的作用】
官方大模型客户端库与 SDK 往往会返回包含丰富元数据的对象（例如 OpenAI Responses API 中的 reasoning.status、Anthropic extended thinking 元信息）。在多轮对话回放历史时，如果将这些包含只读元数据的完整上下文重新发回第三方中转聚合站，下游网关（如 OneAPI、NewAPI、各类反代中继）容易因 JSON Schema 校验过严而抛出 400 Bad Request 错误。

【工作原理】：
Pi 模型提供商管理器在运行时通过 before_provider_request 请求拦截钩子，在实际网络请求发出前动态递归遍历载荷，清洗并剥离导致报错的非法/只读字段，保障长多轮对话流畅进行。`,
    impact: "消除多轮对话中转报错，确保各类第三方网关下的稳定性。",
    defaultValue: "默认关闭（按需开启）",
  },

  // === 细项：过滤 Responses 思考状态 ===
  omitResponsesReasoningStatus: {
    id: "omitResponsesReasoningStatus",
    name: "过滤 Responses 思考状态 (omitResponsesReasoningStatus)",
    field: "omitResponsesReasoningStatus",
    category: "adaptation",
    description: "剥离多轮请求回放中 reasoning 对象的只读 output 字段 status，解决第三方中转站报错。",
    details: `【问题背景与现象】
在使用 OpenAI Responses API (如 o1/o3-mini/GPT-5 系列) 或部分支持思考链的模型时，官方服务端在流式响应中会返回带 status 字段的 reasoning 对象（例如 { type: "reasoning", status: "completed", output: [...] }）。
当进入多轮对话时，Pi 会将历史上下文作为 messages 回传。官方 API 允许该字段，但许多第三方中转站的请求校验器会判定 status 为非法传入参数，导致返回：
"400 Bad Request: Extra inputs are not permitted for reasoning" 或类似报错。

【解决方案】：
开启此项后，Pi 请求拦截器会在向上游发送前自动递归扫描并剥离 messages / input_items 数组中所有的 reasoning.status 字段，只保留合法的 output 思考内容与纯文本。`,
    impact: "彻底解决第三方 Responses API 中转站多轮对话中出现的 400 校验失败问题。",
    example: "开启 (true) / 继承 (inherit)",
    defaultValue: "继承提供商 (默认 false)",
  },
};

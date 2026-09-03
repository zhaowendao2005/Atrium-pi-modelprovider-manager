/**
 * 模型测试模块类型定义
 * 兼容 Pi Coding Agent RPC 协议与 Vercel AI SDK 消息规范
 */

export type ExecutionState =
  | "idle" // 空闲状态，等待执行
  | "preparing_workspace" // 正在初始化沙箱工作空间
  | "running_agent" // 正在执行 Pi Agent RPC 进程
  | "streaming_reasoning" // 正在接收深度推理思维链 (Thinking)
  | "calling_tool" // 正在下发/执行工具调用
  | "streaming_text" // 正在流式输出正文文本
  | "completed" // 执行成功完成
  | "stopped" // 用户手动中断停止
  | "error"; // 发生错误

export type TaskCategory =
  | "all"
  | "availability"
  | "reasoning"
  | "tools"
  | "speed"
  | "custom";

export interface ToolInvocationState {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: "call" | "result" | "partial-call";
  result?: any;
  error?: string;
  executionTimeMs?: number;
  isCollapsed?: boolean;
}

export interface ReasoningData {
  content: string;
  state: "streaming" | "completed";
  durationMs?: number;
  collapsed?: boolean;
}

/**
 * 现代 Agent 时间线内容块模型 (Timeline Parts)
 */
export type MessagePart =
  | {
      id: string;
      type: "reasoning";
      content: string;
      state: "streaming" | "completed";
      durationMs?: number;
      collapsed?: boolean;
      createdAt: number;
    }
  | {
      id: string;
      type: "text";
      content: string;
      isStreaming?: boolean;
      createdAt: number;
    }
  | {
      id: string; // 即 toolCallId
      type: "tool";
      toolCallId: string;
      toolName: string;
      args: Record<string, any>;
      state: "call" | "result" | "partial-call";
      result?: any;
      error?: string;
      executionTimeMs?: number;
      isCollapsed?: boolean;
      createdAt: number;
    };

/**
 * 兼容 Vercel AI SDK UIMessage 结构并支持时序块流
 */
export interface UIMessage {
  id: string;
  role: "system" | "user" | "assistant" | "tool" | "data";
  content: string;
  parts?: MessagePart[]; // ★ 严格按时间线发生的时序内容块
  createdAt: number;
  reasoning?: ReasoningData;
  toolInvocations?: ToolInvocationState[];
  isStreaming?: boolean;
  metrics?: {
    latencyMs?: number;
    tokens?: number;
    tps?: number;
  };
}

/**
 * 测试任务场景定义
 */
export interface TestTask {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  providerId?: string;
  modelId?: string;
  systemPrompt?: string;
  userPrompt: string;
  // 运行记录
  status: "idle" | "running" | "success" | "failed" | "stopped";
  lastRunAt?: number;
  workspaceDir?: string;
  lastMetrics?: {
    totalDurationMs: number;
    firstTokenMs: number;
    totalTokens: number;
    tps: number;
  };
}

export interface TestMetrics {
  totalDurationMs: number;
  firstTokenMs: number;
  totalTokens: number;
  completionTokens: number;
  tps: number; // Tokens Per Second
  toolCallsCount: number;
}

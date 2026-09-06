import type { TestTask } from "../types/testing.js";

export const DEFAULT_TEST_TASKS: TestTask[] = [
  {
    id: "01_site_availability",
    name: "环境可用性自检 (Availability)",
    description: "验证沙箱目录内的 skills.md 规范与内置工具读写能力",
    category: "availability",
    order: 1,
    allowNet: false,
    expectedOutputs: ["test_log.json"],
    userPrompt:
      "请仔细阅读当前目录下的 skills.md 和 workspace_instructions.md，理解所有目录与安全限制，确认当前沙箱工作空间环境可用，并将自检状态记录到 test_log.json 中。",
    status: "idle",
  },
  {
    id: "02_deep_reasoning",
    name: "深度推理测试 (Deep Reasoning)",
    description: "检验模型思维链输出、严格目录隔离与安全边界推导",
    category: "reasoning",
    order: 2,
    allowNet: false,
    expectedOutputs: ["test_summary.txt"],
    systemPrompt: "You are a senior security engineer. Think step by step before answering.",
    userPrompt:
      "请一步步深度分析当前工作目录 skills.md 中的拦截规则：如何保证所有命令仅在本地执行？如何验证外部网络请求被100%拦截？请详细输出推导过程与证明。",
    status: "idle",
  },
  {
    id: "03_multi_tool_pipeline",
    name: "多工具链调用 (Multi-tool Pipeline)",
    description: "测试多工具调用体接收、链式执行与文件读写能力",
    category: "tools",
    order: 3,
    allowNet: false,
    expectedOutputs: ["test_results/command_results.txt"],
    userPrompt:
      "请按顺序执行以下任务：\n1. 列出当前工作目录下的全部文件与目录结构；\n2. 将当前任务的开始时间与运行环境说明写入 test_results/command_results.txt；\n3. 重新读取该文件内容并向我做简要汇报。",
    status: "idle",
  },
  {
    id: "04_speed_benchmark",
    name: "本地执行基准测速 (Speed Benchmark)",
    description: "执行本地基础文件与命令操作，测量执行耗时与吞吐",
    category: "speed",
    order: 4,
    allowNet: false,
    expectedOutputs: ["test_results/speed_test.txt"],
    userPrompt:
      "请在当前工作空间内进行一次基准测试：测量使用本地命令创建 3 个小文本文件并读取它们的总耗时，将测速指标写入 test_results/speed_test.txt 并总结。",
    status: "idle",
  },
  {
    id: "05_vue_tui_scanner_execution",
    name: "Vue TUI 扫描器计划执行 (Plan Execution)",
    description: "离线沙箱环境提供计划文档与 vue-tui 资料，让 Agent 完成 TUI 程序开发",
    category: "plan-execution",
    order: 5,
    allowNet: false,
    expectedOutputs: [
      "test_log.json",
      "test_summary.txt",
      "output/src/main.ts",
      "output/src/app.vue",
      "output/package.json",
    ],
    userPrompt:
      "你必须在当前沙箱工作目录内，严格按照 plan.md 中的计划，使用 docs/ 目录下的 vue-tui 资料文档，完成一个基于 Vue TUI 框架的终端文件树扫描工具的完整代码。\n\n要求：\n1. 仔细阅读 plan.md 中的计划文档和 docs/ 目录下的所有资料文档\n2. 在 output/ 目录中创建完整可运行的 Vue TUI 项目\n3. 确保代码符合规范，并将关键决策记录到 test_log.json\n4. 最终总结写入 test_summary.txt",
    status: "idle",
  },
];

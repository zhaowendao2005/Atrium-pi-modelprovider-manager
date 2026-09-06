import { Container, Input, Key, matchesKey, Spacer, Text, type Component, type Focusable, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ModelManagerData, ModelManagerItem } from "./model-manager-types.js";
import { filterAndRankModels } from "./model-manager-search.js";

export type ModelManagerTab = "default" | "provider" | "series";

export interface ModelManagerCallbacks {
  getData(): ModelManagerData;
  onSelect(item: ModelManagerItem): Promise<void> | void;
  onCancel(): void;
}

type Row = { kind: "group" | "model"; label: string; item?: ModelManagerItem; count?: number };

export class ModelManagerComponent extends Container implements Component, Focusable {
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly callbacks: ModelManagerCallbacks;
  private readonly title: Text;
  private readonly tabs: Text;
  private readonly search: Input;
  private readonly list: Container;
  private readonly status: Text;
  private readonly hint: Text;
  private data: ModelManagerData;
  private tab: ModelManagerTab = "default";
  private rows: Row[] = [];
  private selected = 0;
  private _focused = false;

  constructor(tui: TUI, theme: Theme, callbacks: ModelManagerCallbacks, initialQuery?: string) {
    super();
    this.tui = tui;
    this.theme = theme;
    this.callbacks = callbacks;
    this.data = callbacks.getData();
    this.title = new Text("", 0, 0);
    this.tabs = new Text("", 0, 0);
    this.search = new Input();
    if (initialQuery) this.search.setValue(initialQuery);
    this.search.onSubmit = () => this.selectCurrent();
    this.list = new Container();
    this.status = new Text("", 0, 0);
    this.hint = new Text("", 0, 0);
    this.addChild(this.title);
    this.addChild(this.tabs);
    this.addChild(new Spacer(1));
    this.addChild(this.search);
    this.addChild(new Spacer(1));
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    this.addChild(this.status);
    this.addChild(this.hint);
    this.rebuild();
  }

  get focused(): boolean { return this._focused; }
  set focused(value: boolean) { this._focused = value; this.search.focused = value; }

  private rebuild(): void {
    this.data = this.callbacks.getData();
    const ranked = filterAndRankModels(this.search.getValue(), this.data.items);
    this.rows = this.buildRows(ranked);
    this.selected = Math.min(this.selected, Math.max(0, this.rows.length - 1));
    this.refreshView();
  }

  private buildRows(items: ModelManagerItem[]): Row[] {
    if (this.tab === "default") return items.map((item) => ({ kind: "model", label: item.modelId, item }));
    const groups = new Map<string, ModelManagerItem[]>();
    for (const item of items) {
      const key = this.tab === "provider" ? item.providerName : item.series;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const rows: Row[] = [];
    for (const [label, group] of groups) {
      rows.push({ kind: "group", label, count: group.length });
      rows.push(...group.map((item) => ({ kind: "model" as const, label: item.modelId, item })));
    }
    return rows;
  }

  private refreshView(): void {
    const current = this.data.items.find((item) => item.isCurrent);
    this.title.setText(`${this.theme.fg("accent", "Model Manager")}  ${this.theme.fg("muted", "当前: ")}${this.theme.fg("text", current ? `${current.providerId}/${current.modelId}` : "未选择")}`);
    const names: Array<[ModelManagerTab, string]> = [["default", "默认"], ["provider", "提供商"], ["series", "系列"]];
    this.tabs.setText(names.map(([tab, label]) => tab === this.tab ? this.theme.fg("accent", `[${label}]`) : this.theme.fg("muted", ` ${label} `)).join("  "));
    this.hint.setText(this.theme.fg("muted", "输入搜索 · ↑↓ 移动 · Enter 选择 · Tab 切换 · Esc 关闭"));
    this.list.clear();
    const maxVisible = 12;
    const start = Math.max(0, Math.min(this.selected - 5, Math.max(0, this.rows.length - maxVisible)));
    const end = Math.min(this.rows.length, start + maxVisible);
    for (let index = start; index < end; index++) {
      const row = this.rows[index];
      const prefix = index === this.selected ? this.theme.fg("accent", "→ ") : "  ";
      if (row.kind === "group") {
        this.list.addChild(new Text(`${prefix}${this.theme.fg(index === this.selected ? "accent" : "muted", `${row.label} (${row.count})`)}`, 0, 0));
        continue;
      }
      const item = row.item!;
      const mark = item.isCurrent ? " ✓" : "";
      const detail = this.theme.fg("muted", ` [${item.providerName}${item.series ? ` · ${item.series}` : ""}]`);
      const line = `${prefix}${row.label}${mark}${detail}`;
      this.list.addChild(new Text(index === this.selected ? this.theme.fg("accent", line) : line, 0, 0));
    }
    if (this.rows.length === 0) this.list.addChild(new Text(this.theme.fg("muted", "  无匹配模型"), 0, 0));
    this.status.setText(this.rows.length ? this.theme.fg("muted", `  ${this.selected + 1}/${this.rows.length}`) : "");
    this.tui.requestRender();
  }

  render(width: number): string[] {
    return super.render(width);
  }

  private selectCurrent(): void {
    const row = this.rows[this.selected];
    if (!row?.item) return;
    void this.callbacks.onSelect(row.item);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) { this.callbacks.onCancel(); return; }
    if (matchesKey(data, Key.tab)) {
      this.tab = this.tab === "default" ? "provider" : this.tab === "provider" ? "series" : "default";
      this.selected = 0;
      this.rebuild();
      return;
    }
    if (matchesKey(data, Key.up)) { this.selected = Math.max(0, this.selected - 1); this.refreshView(); return; }
    if (matchesKey(data, Key.down)) { this.selected = Math.min(Math.max(0, this.rows.length - 1), this.selected + 1); this.refreshView(); return; }
    if (matchesKey(data, Key.enter)) { this.selectCurrent(); return; }
    this.search.handleInput(data);
    this.selected = 0;
    this.rebuild();
  }
}

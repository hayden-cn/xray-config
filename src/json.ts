import { parse, ParseError } from "jsonc-parser";
import { allChildPaths, descendantSections } from "./layout";
import type { TabContents } from "./types";

export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const value = parse(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  return errors.length > 0 ? undefined : value;
}

function format(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2) ?? "";
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (!isObject(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function removeRelativePath(root: Record<string, unknown>, segs: string[]) {
  if (segs.length === 0) return;
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const v = cur[segs[i]];
    if (!isObject(v)) return;
    cur = v;
  }
  delete cur[segs[segs.length - 1]];
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (isObject(v)) return Object.keys(v).length === 0;
  return false;
}

function setAtPath(root: Record<string, unknown>, path: string, value: unknown) {
  const segs = path.split(".");
  let cur = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (!isObject(cur[s])) cur[s] = {};
    cur = cur[s] as Record<string, unknown>;
  }
  cur[segs[segs.length - 1]] = value;
}

/** 剔除对象中属于独立 section 的子键（如 routing 中的 rules/balancers） */
function stripDescendants(value: unknown, path: string): unknown {
  const descendants = descendantSections(path);
  if (descendants.length === 0 || !isObject(value)) return value;
  const copy = clone(value);
  for (const sub of descendants) {
    removeRelativePath(copy, sub.split(".").slice(path.split(".").length));
  }
  return copy;
}

/** 从全量配置文本拆出各 child section 的编辑文本（空串 = 不存在/为空） */
export function splitSections(raw: string): Record<string, string> {
  const root = parseJsonc(raw);
  const obj = isObject(root) ? root : {};
  const sections: Record<string, string> = {};
  for (const path of allChildPaths()) {
    const v = getAtPath(obj, path);
    if (v === undefined) {
      sections[path] = "";
      continue;
    }
    const stripped = stripDescendants(v, path);
    sections[path] = isEmptyValue(stripped) ? "" : format(stripped);
  }
  return sections;
}

/** 从 sections 重建全量对象（跳过空串/空对象/空数组） */
export function buildFull(sections: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // 父路径先于子路径处理，避免父级（如 routing）整体覆盖已写入的子 section（rules/balancers）
  const paths = allChildPaths().sort((a, b) => a.split(".").length - b.split(".").length);
  for (const path of paths) {
    const text = sections[path];
    if (!text || !text.trim()) continue;
    const v = parseJsonc(text);
    if (v === undefined) continue;
    const value = stripDescendants(v, path);
    if (isEmptyValue(value)) continue;
    setAtPath(result, path, value);
  }
  return result;
}

/** sections → 后端契约 TabContents（五段字符串） */
export function sectionsToTabs(sections: Record<string, string>): TabContents {
  const full = buildFull(sections);
  const routing = isObject(full.routing) ? full.routing : {};

  const other: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(full)) {
    if (k === "inbounds" || k === "outbounds") continue;
    if (k === "routing") {
      const reduced = clone(routing);
      delete reduced.rules;
      delete reduced.balancers;
      if (Object.keys(reduced).length > 0) other.routing = reduced;
      continue;
    }
    other[k] = v;
  }

  return {
    inbounds: format(full.inbounds),
    outbounds: format(full.outbounds),
    rules: format(routing.rules),
    balancers: format(routing.balancers),
    other: Object.keys(other).length > 0 ? format(other) : "{}",
  };
}

export interface Profile {
  id: string;
  name: string;
  path: string;
  apiAddress?: string | null;
  xrayPath?: string | null;
}

export interface TemplateEntry {
  file: string;
  keys: string[];
}

export interface Settings {
  defaultXrayPath?: string | null;
  defaultMultiFileTemplate: TemplateEntry[];
  theme?: "light" | "dark" | "system" | null;
}

export type TabKey = "inbounds" | "outbounds" | "rules" | "balancers" | "other";

export type TabContents = Record<TabKey, string>;

export interface ReadConfigResult {
  mode: "folder" | "file";
  content: string;
  files: string[];
  warning?: string | null;
}

export interface TestResult {
  ok: boolean;
  code: number;
  message: string;
  stdout: string;
  stderr: string;
}

export interface ApiStep {
  command: string;
  ok: boolean;
  message: string;
}

export interface ApiUpdateResult {
  ok: boolean;
  message: string;
  steps: ApiStep[];
}

export interface ApplyResult {
  ok: boolean;
  message: string;
  test?: TestResult | null;
  writtenFiles: string[];
  apiUpdate?: ApiUpdateResult | null;
}

export const DEFAULT_TEMPLATE: TemplateEntry[] = [
  { file: "00_log.jsonc", keys: ["log"] },
  { file: "01_api.jsonc", keys: ["api"] },
  { file: "02_dns.jsonc", keys: ["dns"] },
  { file: "03_routing.jsonc", keys: ["routing"] },
  { file: "04_policy.jsonc", keys: ["policy"] },
  { file: "05_inbounds.jsonc", keys: ["inbounds"] },
  { file: "06_outbounds.jsonc", keys: ["outbounds"] },
  { file: "07_stats.jsonc", keys: ["stats"] },
  { file: "08_fakedns.jsonc", keys: ["fakedns"] },
  { file: "09_metrics.jsonc", keys: ["metrics"] },
  { file: "10_observatory.jsonc", keys: ["observatory", "burstObservatory"] },
  { file: "11_geodata.jsonc", keys: ["geodata"] },
  { file: "12_env.jsonc", keys: ["env"] },
  { file: "98_other.jsonc", keys: ["*"] },
  { file: "99_version.jsonc", keys: ["version"] },
];

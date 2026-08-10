import { jsonDefaults } from "monaco-editor/language/json/monaco.contribution";
import { allChildPaths } from "./layout";
import rawSchema from "./schemas/xray-schema.json";

type Schema = Record<string, unknown>;

const schema = rawSchema as Schema & {
  definitions: Record<string, unknown>;
};

/** section 路径 → Monaco model URI */
export function sectionUri(path: string): string {
  return `file:///xray/${path}.json`;
}

/** 数组类 section（items 为对应定义） */
const ARRAY_DEFS: Record<string, string> = {
  inbounds: "InboundObject",
  outbounds: "OutboundObject",
  "routing.rules": "RuleObject",
  "routing.balancers": "BalancerObject",
};

/** 对象类 section（整体校验为对应定义） */
const SINGLE_DEFS: Record<string, string> = {
  log: "LogObject",
  api: "ApiObject",
  dns: "DnsObject",
  fakedns: "FakeDNSObject",
  policy: "PolicyObject",
  stats: "StatsObject",
  metrics: "MetricsObject",
  observatory: "ObservatoryObject",
  burstObservatory: "BurstObservatoryObject",
  geodata: "GeodataObject",
  env: "EnvObject",
  version: "VersionObject",
  reverse: "ReverseObject",
  routing: "RoutingObject",
};

function wrapArray(itemRef: string): Schema {
  return {
    $schema: "https://json-schema.org/draft-07/schema",
    type: "array",
    items: { $ref: `#/definitions/${itemRef}` },
    definitions: schema.definitions,
  };
}

function buildSchemas(): { uri: string; fileMatch: string[]; schema: Schema }[] {
  return allChildPaths()
    .map((path) => {
      const arrayDef = ARRAY_DEFS[path];
      const singleDef = SINGLE_DEFS[path];
      let sch: Schema;
      if (arrayDef) {
        sch = wrapArray(arrayDef);
      } else if (singleDef) {
        sch = { $ref: `#/definitions/${singleDef}`, definitions: schema.definitions };
      } else {
        return null;
      }
      return { uri: `xray://schema/${path}`, fileMatch: [`**/xray/${path}.json`], schema: sch };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

let initialized = false;

export function initSchema() {
  if (initialized) return;
  initialized = true;
  jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    comments: "ignore",
    trailingCommas: "ignore",
    schemaValidation: "warning",
    schemas: buildSchemas(),
  });
}

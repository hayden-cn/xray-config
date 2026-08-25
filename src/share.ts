import type { InboundObject } from "./inbounds";
import type { OutboundObject } from "./outbounds";

export interface ShareLink {
  label: string;
  url: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function b64json(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

/** 从 streamSettings 提取客户端分享所需的 transport + security query params */
function streamParams(stream?: Record<string, unknown>): Record<string, string> {
  if (!stream) return {};
  const p: Record<string, string> = {};
  const method = str(stream.method);
  const security = str(stream.security);

  if (method) p.type = method;
  if (security && security !== "none") p.security = security;

  // --- transport-specific ---
  const raw = isObj(stream.rawSettings) ? stream.rawSettings : undefined;
  const ws = isObj(stream.wsSettings) ? stream.wsSettings : undefined;
  const kcp = isObj(stream.kcpSettings) ? stream.kcpSettings : undefined;
  const grpc = isObj(stream.grpcSettings) ? stream.grpcSettings : undefined;
  const httpupgrade = isObj(stream.httpupgradeSettings) ? stream.httpupgradeSettings : undefined;
  const xhttp = isObj(stream.xhttpSettings) ? stream.xhttpSettings : undefined;

  if (method === "ws" && isObj(ws)) {
    if (str(ws.path)) p.path = str(ws.path);
    const wsHeaders = isObj(ws.headers) ? (ws.headers as Record<string, unknown>) : undefined;
    if (wsHeaders && str(wsHeaders.Host)) p.host = str(wsHeaders.Host);
  } else if (method === "grpc" && isObj(grpc)) {
    if (str(grpc.serviceName)) p.serviceName = str(grpc.serviceName);
  } else if (method === "kcp" && isObj(kcp)) {
    const header = isObj(kcp.header) ? kcp.header : undefined;
    if (header && str(header.type) && str(header.type) !== "none") p.headerType = str(header.type);
    if (str(kcp.seed)) p.seed = str(kcp.seed);
  } else if (method === "httpupgrade" && isObj(httpupgrade)) {
    if (str(httpupgrade.path)) p.path = str(httpupgrade.path);
    const huHosts = strArr(httpupgrade.host);
    if (huHosts.length > 0) p.host = huHosts[0];
  } else if (method === "xhttp" && isObj(xhttp)) {
    if (str(xhttp.mode)) p.mode = str(xhttp.mode);
    if (str(xhttp.path)) p.path = str(xhttp.path);
    const xhost = strArr(xhttp.host);
    if (xhost.length > 0) p.host = xhost[0];
  } else if (method === "raw" && isObj(raw)) {
    const rawHeader = isObj(raw.header) ? raw.header : undefined;
    if (rawHeader && str(rawHeader.type) && str(rawHeader.type) !== "none") {
      p.headerType = str(rawHeader.type);
      if (str(rawHeader.type) === "http") {
        const req = isObj(rawHeader.request) ? rawHeader.request : undefined;
        if (isObj(req)) {
          const path = strArr(req.path);
          if (path.length > 0) p.path = path[0];
          const reqHeaders = isObj(req.headers) ? (req.headers as Record<string, unknown>) : undefined;
          const host = reqHeaders ? strArr(reqHeaders.Host) : [];
          if (host.length > 0) p.host = host[0];
        }
      }
    }
  }

  // --- security-specific ---
  if (security === "tls") {
    const tls = isObj(stream.tlsSettings) ? stream.tlsSettings : undefined;
    if (isObj(tls)) {
      if (str(tls.serverName) || str(tls.allowInsecure)) {
        p.sni = str(tls.serverName);
      }
      if (str(tls.fingerprint)) p.fp = str(tls.fingerprint);
      const alpn = strArr(tls.alpn);
      if (alpn.length > 0) p.alpn = alpn.join(",");
    }
    // also check top-level sni for tls
    if (!p.sni && str(stream.sni)) p.sni = str(stream.sni);
    if (!p.fp && str(stream.fingerprint)) p.fp = str(stream.fingerprint);
  } else if (security === "reality") {
    const reality = isObj(stream.realitySettings) ? stream.realitySettings : undefined;
    if (isObj(reality)) {
      // client-side: serverName → sni, publicKey → pbk, shortId → sid, spiderX → spx
      if (str(reality.serverName)) p.sni = str(reality.serverName);
      if (str(reality.publicKey)) p.pbk = str(reality.publicKey);
      if (str(reality.shortId)) p.sid = str(reality.shortId);
      if (str(reality.spiderX)) p.spx = str(reality.spiderX);
      if (str(reality.fingerprint)) p.fp = str(reality.fingerprint);
    }
    if (!p.sni && str(stream.sni)) p.sni = str(stream.sni);
    if (!p.fp && str(stream.fingerprint)) p.fp = str(stream.fingerprint);
  }

  return p;
}

function buildQueryString(params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${enc(v)}`).join("&");
}

/** 为单个 vless 用户生成分享链接 */
function vlessLink(
  user: Record<string, unknown>,
  host: string,
  port: number | string,
  tag: string,
  stream?: Record<string, unknown>,
): ShareLink | null {
  const id = str(user.id);
  if (!id) return null;
  const flow = str(user.flow);
  const params = streamParams(stream);
  if (flow) params.flow = flow;
  params.encryption = "none";
  const qs = buildQueryString(params);
  const label = str(user.email) || tag;
  return {
    label,
    url: `vless://${enc(id)}@${enc(host)}:${port}${qs}#${enc(tag)}`,
  };
}

/** 为单个 vmess 用户生成分享链接（V2RayN 格式） */
function vmessLink(
  user: Record<string, unknown>,
  host: string,
  port: number | string,
  tag: string,
  stream?: Record<string, unknown>,
): ShareLink | null {
  const id = str(user.id);
  if (!id) return null;
  const method = str(stream?.method) || "tcp";
  const security = str(stream?.security);
  const tlsEnabled = security === "tls" || security === "reality";
  const net = method === "raw" ? "tcp" : method;

  const obj: Record<string, unknown> = {
    v: "2",
    ps: tag,
    add: host,
    port: String(port),
    id,
    aid: typeof user.alterId === "number" ? user.alterId : 0,
    scy: str(user.security) || "auto",
    net,
    type: "none",
    host: "",
    path: "",
    tls: tlsEnabled ? "tls" : "",
  };

  // transport path/host
  if (net === "ws" && isObj(stream?.wsSettings)) {
    const ws = stream.wsSettings as Record<string, unknown>;
    obj.path = str(ws.path);
    const wsHeaders = isObj(ws.headers) ? ws.headers : undefined;
    if (isObj(wsHeaders) && str(wsHeaders.Host)) obj.host = str(wsHeaders.Host);
  } else if (net === "grpc" && isObj(stream?.grpcSettings)) {
    const g = stream.grpcSettings as Record<string, unknown>;
    obj.path = str(g.serviceName);
  } else if (net === "kcp" && isObj(stream?.kcpSettings)) {
    const k = stream.kcpSettings as Record<string, unknown>;
    const hdr = isObj(k.header) ? k.header : undefined;
    if (isObj(hdr) && str(hdr.type)) obj.type = str(hdr.type);
    if (str(k.seed)) obj.path = str(k.seed);
  }

  // tls
  if (security === "tls" && isObj(stream?.tlsSettings)) {
    const tls = stream.tlsSettings as Record<string, unknown>;
    if (str(tls.serverName)) obj.sni = str(tls.serverName);
    if (str(tls.fingerprint)) obj.fp = str(tls.fingerprint);
    const alpn = strArr(tls.alpn);
    if (alpn.length > 0) obj.alpn = alpn.join(",");
  } else if (security === "reality" && isObj(stream?.realitySettings)) {
    const r = stream.realitySettings as Record<string, unknown>;
    if (str(r.serverName)) obj.sni = str(r.serverName);
    if (str(r.fingerprint)) obj.fp = str(r.fingerprint);
    if (str(r.publicKey)) obj.pbk = str(r.publicKey);
    if (str(r.shortId)) obj.sid = str(r.shortId);
    if (str(r.spiderX)) obj.spx = str(r.spiderX);
  }

  const label = str(user.email) || tag;
  return { label, url: `vmess://${b64json(obj)}` };
}

/** 为单个 trojan 用户生成分享链接 */
function trojanLink(
  user: Record<string, unknown>,
  host: string,
  port: number | string,
  tag: string,
  stream?: Record<string, unknown>,
): ShareLink | null {
  const password = str(user.password);
  if (!password) return null;
  const params = streamParams(stream);
  // trojan always uses tls
  if (!params.security) params.security = "tls";
  const qs = buildQueryString(params);
  const label = str(user.email) || tag;
  return {
    label,
    url: `trojan://${enc(password)}@${enc(host)}:${port}${qs}#${enc(tag)}`,
  };
}

/** 为 shadowsocks 入站生成分享链接 */
function ssLink(
  settings: Record<string, unknown>,
  host: string,
  port: number | string,
  tag: string,
): ShareLink | null {
  const method = str(settings.method);
  const password = str(settings.password);
  if (!method || !password) return null;
  const userInfo = b64(`${method}:${password}`);
  return {
    label: tag,
    url: `ss://${userInfo}@${enc(host)}:${port}#${enc(tag)}`,
  };
}

// ---------------------------------------------------------------------------
// 分享链接解析（反向：链接 → OutboundObject）
// ---------------------------------------------------------------------------

function decodeB64(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    return "";
  }
}

function parseQueryString(qs: string): Record<string, string> {
  const p: Record<string, string> = {};
  if (!qs) return p;
  for (const part of qs.replace(/^\?/, "").split("&")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = decodeURIComponent(part.slice(0, idx));
    const v = decodeURIComponent(part.slice(idx + 1));
    if (k) p[k] = v;
  }
  return p;
}

/** 将 share link 的 type 参数映射为 xray streamSettings.method */
function typeToMethod(type: string): string {
  const map: Record<string, string> = {
    tcp: "raw",
    raw: "raw",
    kcp: "mkcp",
    ws: "websocket",
    grpc: "grpc",
    httpupgrade: "httpupgrade",
    xhttp: "xhttp",
  };
  return map[type] || type || "raw";
}

/** 根据 query params 重建 streamSettings（出站客户端视角） */
function buildStreamFromParams(
  params: Record<string, string>,
): Record<string, unknown> | undefined {
  const security = params.security || "";
  const type = params.type || "";
  const method = typeToMethod(type);
  const stream: Record<string, unknown> = {};

  if (method) stream.method = method;
  if (security && security !== "none") stream.security = security;

  // --- transport ---
  if (method === "websocket") {
    const ws: Record<string, unknown> = {};
    if (params.path) ws.path = params.path;
    if (params.host) ws.headers = { Host: params.host };
    if (Object.keys(ws).length > 0) stream.wsSettings = ws;
  } else if (method === "grpc") {
    if (params.serviceName) stream.grpcSettings = { serviceName: params.serviceName };
  } else if (method === "mkcp") {
    const kcp: Record<string, unknown> = {};
    if (params.headerType && params.headerType !== "none") kcp.header = { type: params.headerType };
    if (params.seed) kcp.seed = params.seed;
    if (Object.keys(kcp).length > 0) stream.kcpSettings = kcp;
  } else if (method === "httpupgrade") {
    const hu: Record<string, unknown> = {};
    if (params.path) hu.path = params.path;
    if (params.host) hu.host = [params.host];
    if (Object.keys(hu).length > 0) stream.httpupgradeSettings = hu;
  } else if (method === "xhttp") {
    const xh: Record<string, unknown> = {};
    if (params.mode) xh.mode = params.mode;
    if (params.path) xh.path = params.path;
    if (params.host) xh.host = [params.host];
    if (Object.keys(xh).length > 0) stream.xhttpSettings = xh;
  } else if (method === "raw") {
    if (params.headerType && params.headerType !== "none") {
      stream.rawSettings = { header: { type: params.headerType } };
    }
  }

  // --- security ---
  if (security === "tls") {
    const tls: Record<string, unknown> = {};
    if (params.sni) tls.serverName = params.sni;
    if (params.fp) tls.fingerprint = params.fp;
    if (params.alpn) tls.alpn = params.alpn.split(",");
    if (Object.keys(tls).length > 0) stream.tlsSettings = tls;
  } else if (security === "reality") {
    const r: Record<string, unknown> = {};
    if (params.sni) r.serverName = params.sni;
    if (params.fp) r.fingerprint = params.fp;
    if (params.pbk) r.publicKey = params.pbk;
    if (params.sid) r.shortId = params.sid;
    if (params.spx) r.spiderX = params.spx;
    if (Object.keys(r).length > 0) stream.realitySettings = r;
  }

  return Object.keys(stream).length > 0 ? stream : undefined;
}

/** 解析 vless:// 链接 */
function parseVless(raw: string): OutboundObject | null {
  // vless://uuid@host:port?params#tag
  const m = raw.match(/^vless:\/\/([^@]+)@([^:?#/]+):(\d+)(\?[^#]*)?(?:#(.*))?$/);
  if (!m) return null;
  const [, uuid, address, portStr, qs, fragment] = m;
  const params = parseQueryString(qs || "");
  const tag = fragment ? decodeURIComponent(fragment) : "";
  const settings: Record<string, unknown> = {
    address: decodeURIComponent(address),
    port: Number(portStr) || portStr,
    id: decodeURIComponent(uuid),
    encryption: params.encryption || "none",
  };
  if (params.flow) settings.flow = params.flow;

  const stream = buildStreamFromParams(params);
  const out: OutboundObject = { tag, protocol: "vless", settings };
  if (stream) out.streamSettings = stream;
  return out;
}

/** 解析 vmess:// 链接（V2RayN base64 格式） */
function parseVmess(raw: string): OutboundObject | null {
  const b64 = raw.replace(/^vmess:\/\//, "").trim();
  const json = decodeB64(b64);
  if (!json) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json);
  } catch {
    return null;
  }
  const tag = typeof obj.ps === "string" ? obj.ps : "";
  const address = typeof obj.add === "string" ? obj.add : "";
  const port = typeof obj.port === "string" ? Number(obj.port) || obj.port : obj.port;
  const id = typeof obj.id === "string" ? obj.id : "";
  if (!address || !id) return null;

  const security = typeof obj.scy === "string" ? obj.scy : "auto";
  const settings: Record<string, unknown> = {
    address,
    port,
    id,
    security,
  };
  if (typeof obj.aid === "number" || typeof obj.aid === "string") {
    const aid = Number(obj.aid);
    if (!isNaN(aid)) settings.alterId = aid;
  }

  // --- streamSettings ---
  const stream: Record<string, unknown> = {};
  const net = typeof obj.net === "string" ? obj.net : "tcp";
  const method = typeToMethod(net);
  if (method) stream.method = method;

  // transport
  const host = typeof obj.host === "string" ? obj.host : "";
  const path = typeof obj.path === "string" ? obj.path : "";
  const type = typeof obj.type === "string" ? obj.type : "";

  if (method === "websocket") {
    const ws: Record<string, unknown> = {};
    if (path) ws.path = path;
    if (host) ws.headers = { Host: host };
    if (Object.keys(ws).length > 0) stream.wsSettings = ws;
  } else if (method === "grpc") {
    if (path) stream.grpcSettings = { serviceName: path };
  } else if (method === "mkcp") {
    const kcp: Record<string, unknown> = {};
    if (type && type !== "none") kcp.header = { type };
    if (path) kcp.seed = path;
    if (Object.keys(kcp).length > 0) stream.kcpSettings = kcp;
  } else if (method === "httpupgrade") {
    const hu: Record<string, unknown> = {};
    if (path) hu.path = path;
    if (host) hu.host = [host];
    if (Object.keys(hu).length > 0) stream.httpupgradeSettings = hu;
  } else if (method === "xhttp") {
    const xh: Record<string, unknown> = {};
    if (path) xh.path = path;
    if (host) xh.host = [host];
    if (Object.keys(xh).length > 0) stream.xhttpSettings = xh;
  }

  // security
  const tls = typeof obj.tls === "string" ? obj.tls : "";
  if (tls === "tls" || tls === "reality") {
    stream.security = tls;
    if (tls === "tls") {
      const tlsS: Record<string, unknown> = {};
      if (typeof obj.sni === "string" && obj.sni) tlsS.serverName = obj.sni;
      if (typeof obj.fp === "string" && obj.fp) tlsS.fingerprint = obj.fp;
      if (typeof obj.alpn === "string" && obj.alpn) tlsS.alpn = obj.alpn.split(",");
      if (Object.keys(tlsS).length > 0) stream.tlsSettings = tlsS;
    } else {
      const r: Record<string, unknown> = {};
      if (typeof obj.sni === "string" && obj.sni) r.serverName = obj.sni;
      if (typeof obj.fp === "string" && obj.fp) r.fingerprint = obj.fp;
      if (typeof obj.pbk === "string" && obj.pbk) r.publicKey = obj.pbk;
      if (typeof obj.sid === "string" && obj.sid) r.shortId = obj.sid;
      if (typeof obj.spx === "string" && obj.spx) r.spiderX = obj.spx;
      if (Object.keys(r).length > 0) stream.realitySettings = r;
    }
  }

  const out: OutboundObject = { tag, protocol: "vmess", settings };
  if (Object.keys(stream).length > 0) out.streamSettings = stream;
  return out;
}

/** 解析 trojan:// 链接 */
function parseTrojan(raw: string): OutboundObject | null {
  const m = raw.match(/^trojan:\/\/([^@]+)@([^:?#/]+):(\d+)(\?[^#]*)?(?:#(.*))?$/);
  if (!m) return null;
  const [, password, address, portStr, qs, fragment] = m;
  const params = parseQueryString(qs || "");
  const tag = fragment ? decodeURIComponent(fragment) : "";
  const settings: Record<string, unknown> = {
    address: decodeURIComponent(address),
    port: Number(portStr) || portStr,
    password: decodeURIComponent(password),
  };

  const stream = buildStreamFromParams(params);
  // trojan 默认 tls
  if (stream && !stream.security) stream.security = "tls";
  if (!stream) {
    // 空 params 也要加默认 tls
    const s: Record<string, unknown> = { security: "tls" };
    const out: OutboundObject = { tag, protocol: "trojan", settings, streamSettings: s };
    return out;
  }
  const out: OutboundObject = { tag, protocol: "trojan", settings };
  out.streamSettings = stream;
  return out;
}

/** 解析 ss:// 链接 */
function parseSs(raw: string): OutboundObject | null {
  // ss://base64(method:password)@host:port#tag
  // 也支持 ss://base64(method:password@host:port)#tag
  const withoutHash = raw.split("#")[0] || "";
  const m1 = withoutHash.match(/^ss:\/\/([^@]+)@([^:]+):(\d+)$/);
  let userInfo: string;
  let address: string;
  let portStr: string;
  if (m1) {
    [, userInfo, address, portStr] = m1;
  } else {
    // base64 包含整个 userInfo@host:port
    const m2 = withoutHash.match(/^ss:\/\/(.+)$/);
    if (!m2) return null;
    const decoded = decodeB64(m1 ? m1[1] : m2[1]);
    const m3 = decoded.match(/^([^:]+):(.+)@([^:]+):(\d+)$/);
    if (!m3) return null;
    [, , , address, portStr] = m3;
    userInfo = m2[1];
  }
  // 从 base64 解码 method:password
  const decoded = decodeB64(userInfo);
  const colonIdx = decoded.indexOf(":");
  if (colonIdx < 0) return null;
  const method = decoded.slice(0, colonIdx);
  const password = decoded.slice(colonIdx + 1);
  if (!method || !password) return null;

  const tagIdx = raw.indexOf("#");
  const tag = tagIdx >= 0 ? decodeURIComponent(raw.slice(tagIdx + 1)) : "";

  const settings: Record<string, unknown> = {
    address,
    port: Number(portStr) || portStr,
    method,
    password,
  };
  const out: OutboundObject = { tag, protocol: "shadowsocks", settings };
  return out;
}

/** 单条链接解析结果 */
export interface ParsedLink {
  ok: boolean;
  raw: string;
  outbound?: OutboundObject;
  error?: string;
}

/**
 * 解析分享链接文本，每行一条链接，返回解析结果数组。
 */
export function parseShareLinks(text: string): ParsedLink[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const lower = line.toLowerCase();
      let result: OutboundObject | null = null;
      if (lower.startsWith("vless://")) result = parseVless(line);
      else if (lower.startsWith("vmess://")) result = parseVmess(line);
      else if (lower.startsWith("trojan://")) result = parseTrojan(line);
      else if (lower.startsWith("ss://")) result = parseSs(line);
      else return { ok: false, raw: line, error: "不支持的链接格式" };
      if (!result) return { ok: false, raw: line, error: "链接格式错误，无法解析" };
      return { ok: true, raw: line, outbound: result };
    });
}

/**
 * 根据入站配置生成分享链接列表。
 * serverAddress 为用户填写的服务器域名/IP（必填）。
 * port 可选覆盖（默认使用 inbound.port）。
 */
export function generateShareLinks(
  inbound: InboundObject,
  serverAddress: string,
  portOverride?: number | string | null,
): ShareLink[] {
  const host = (serverAddress || "").trim();
  if (!host) return [];
  const port = portOverride ?? inbound.port;
  if (!port) return [];
  const tag = str(inbound.tag);
  const protocol = str(inbound.protocol);
  const settings = isObj(inbound.settings) ? inbound.settings : undefined;
  const stream = isObj(inbound.streamSettings) ? inbound.streamSettings : undefined;

  const users = settings?.users;
  const userList: Record<string, unknown>[] = Array.isArray(users)
    ? (users as Record<string, unknown>[]).filter(isObj)
    : [];

  switch (protocol) {
    case "vless": {
      if (userList.length === 0) return [];
      return userList
        .map((u) => vlessLink(u, host, port, tag, stream))
        .filter((l): l is ShareLink => l !== null);
    }
    case "vmess": {
      if (userList.length === 0) return [];
      return userList
        .map((u) => vmessLink(u, host, port, tag, stream))
        .filter((l): l is ShareLink => l !== null);
    }
    case "trojan": {
      if (userList.length === 0) return [];
      return userList
        .map((u) => trojanLink(u, host, port, tag, stream))
        .filter((l): l is ShareLink => l !== null);
    }
    case "shadowsocks": {
      if (!isObj(settings)) return [];
      const link = ssLink(settings, host, port, tag);
      return link ? [link] : [];
    }
    default:
      return [];
  }
}

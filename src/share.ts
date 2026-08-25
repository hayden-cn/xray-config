import type { InboundObject } from "./inbounds";

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

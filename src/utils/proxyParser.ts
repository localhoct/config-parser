export interface ParsedProxy {
  protocol: string;
  name: string;
  address: string;
  port: number;
  uuid?: string;
  password?: string;
  method?: string;
  security?: string;
  type?: string;
  sni?: string;
  fp?: string;
  flow?: string;
  pbk?: string;
  sid?: string;
  path?: string;
  host?: string;
  alpn?: string;
  encryption?: string;
  rawLink: string;
  // Extracted metadata
  countryCode?: string;
  tag?: string; // [CF], [Direct], [VIP], [FS], etc.
  isVIP?: boolean;
}

export function parseVless(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    return {
      protocol: 'vless',
      name: decodeURIComponent(url.hash.slice(1)),
      address: url.hostname,
      port: parseInt(url.port),
      uuid: url.username,
      security: url.searchParams.get('security') || 'none',
      type: url.searchParams.get('type') || 'tcp',
      sni: url.searchParams.get('sni') || '',
      fp: url.searchParams.get('fp') || '',
      flow: url.searchParams.get('flow') || '',
      pbk: url.searchParams.get('pbk') || '',
      sid: url.searchParams.get('sid') || '',
      path: url.searchParams.get('path') || '',
      host: url.searchParams.get('host') || '',
      alpn: url.searchParams.get('alpn') || '',
      encryption: url.searchParams.get('encryption') || 'none',
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseTrojan(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    return {
      protocol: 'trojan',
      name: decodeURIComponent(url.hash.slice(1)),
      address: url.hostname,
      port: parseInt(url.port),
      password: url.username,
      security: url.searchParams.get('security') || 'tls',
      type: url.searchParams.get('type') || 'tcp',
      sni: url.searchParams.get('sni') || '',
      fp: url.searchParams.get('fp') || '',
      path: url.searchParams.get('path') || '',
      host: url.searchParams.get('host') || '',
      alpn: url.searchParams.get('alpn') || '',
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseSS(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    let method: string, password: string;
    try {
      const decoded = atob(url.username);
      [method, password] = decoded.split(':');
    } catch {
      method = url.username;
      password = '';
    }
    return {
      protocol: 'shadowsocks',
      name: decodeURIComponent(url.hash.slice(1)),
      address: url.hostname,
      port: parseInt(url.port),
      method,
      password,
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseProxyLink(link: string): ParsedProxy | null {
  const trimmed = link.trim();
  if (trimmed.startsWith('vless://')) return parseVless(trimmed);
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed);
  if (trimmed.startsWith('ss://')) return parseSS(trimmed);
  return null;
}

// Extract country code from name (flag emoji or 2-letter code)
export function extractCountryCode(name: string): string {
  // Flag emoji
  const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
  const flagMatch = name.match(flagPattern);
  if (flagMatch) {
    const codePoints = [...flagMatch[0]].map(c => c.codePointAt(0)! - 0x1F1E6 + 65);
    return String.fromCharCode(...codePoints);
  }
  // Text code like DE, NL, FI, US
  const knownCodes = ['DE', 'NL', 'FI', 'US', 'CA', 'SE', 'TR', 'FR', 'GB', 'JP', 'KR', 'SG', 'AU', 'BR', 'IN', 'RU', 'IT', 'ES', 'AT', 'CH'];
  for (const code of knownCodes) {
    if (name.includes(code)) return code;
  }
  return 'OTHER';
}

// Extract tag from name: [CF], [Direct], [VIP], [FS], etc.
export function extractTag(name: string): string {
  // Match [XXX] patterns
  const bracketMatch = name.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  
  // Special patterns
  if (name.includes('~ Hamrah-Aval')) return 'Hamrah-Aval';
  if (name.includes('VIP')) return 'VIP';
  
  return 'default';
}

// Check if this is a VIP config (should not be merged)
export function isVIPConfig(name: string): boolean {
  return name.includes('[VIP]');
}

// Build group key: "DE_CF", "NL_Direct", etc.
export function buildGroupKey(proxy: ParsedProxy): { key: string; country: string; tag: string; isVIP: boolean } {
  const country = extractCountryCode(proxy.name);
  const tag = extractTag(proxy.name);
  const vip = isVIPConfig(proxy.name);
  
  if (vip) {
    return { key: `VIP_${country}_${proxy.name.replace(/[^\w]/g, '_').slice(0, 20)}`, country, tag: 'VIP', isVIP: true };
  }
  
  return { key: `${country}_${tag}`, country, tag, isVIP: false };
}

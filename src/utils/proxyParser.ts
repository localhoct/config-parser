export interface ParsedProxy {
  protocol: string;
  name: string;
  address: string;
  port: number;
  uuid?: string;
  password?: string;
  method?: string;
  security?: string;
  type?: string; // network type: tcp, ws, grpc, etc.
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
  countryCode?: string;
}

export function parseVless(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    const uuid = url.username;
    const address = url.hostname;
    const port = parseInt(url.port);
    const name = decodeURIComponent(url.hash.slice(1));
    
    const params = url.searchParams;
    
    return {
      protocol: 'vless',
      name,
      address,
      port,
      uuid,
      security: params.get('security') || 'none',
      type: params.get('type') || 'tcp',
      sni: params.get('sni') || '',
      fp: params.get('fp') || '',
      flow: params.get('flow') || '',
      pbk: params.get('pbk') || '',
      sid: params.get('sid') || '',
      path: params.get('path') || '',
      host: params.get('host') || '',
      alpn: params.get('alpn') || '',
      encryption: params.get('encryption') || 'none',
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseVmess(link: string): ParsedProxy | null {
  try {
    const b64 = link.replace('vmess://', '');
    const decoded = atob(b64);
    const config = JSON.parse(decoded);
    
    return {
      protocol: 'vmess',
      name: config.ps || '',
      address: config.add || '',
      port: parseInt(config.port),
      uuid: config.id || '',
      security: config.tls || 'none',
      type: config.net || 'tcp',
      sni: config.sni || '',
      path: config.path || '',
      host: config.host || '',
      alpn: config.alpn || '',
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseTrojan(link: string): ParsedProxy | null {
  try {
    const url = new URL(link);
    const password = url.username;
    const address = url.hostname;
    const port = parseInt(url.port);
    const name = decodeURIComponent(url.hash.slice(1));
    
    const params = url.searchParams;
    
    return {
      protocol: 'trojan',
      name,
      address,
      port,
      password,
      security: params.get('security') || 'tls',
      type: params.get('type') || 'tcp',
      sni: params.get('sni') || '',
      fp: params.get('fp') || '',
      path: params.get('path') || '',
      host: params.get('host') || '',
      alpn: params.get('alpn') || '',
      rawLink: link,
    };
  } catch {
    return null;
  }
}

export function parseSS(link: string): ParsedProxy | null {
  try {
    let address: string, port: number, method: string, password: string, name: string;
    
    // Try new format: ss://base64(method:password)@address:port#name
    const url = new URL(link);
    const userInfo = url.username;
    address = url.hostname;
    port = parseInt(url.port);
    name = decodeURIComponent(url.hash.slice(1));
    
    try {
      const decoded = atob(userInfo);
      const [m, p] = decoded.split(':');
      method = m;
      password = p;
    } catch {
      // legacy format
      method = userInfo;
      password = '';
    }
    
    return {
      protocol: 'shadowsocks',
      name,
      address,
      port,
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
  if (trimmed.startsWith('vmess://')) return parseVmess(trimmed);
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed);
  if (trimmed.startsWith('ss://')) return parseSS(trimmed);
  return null;
}

export function extractCountryCode(name: string): string | null {
  // Match country codes from emoji flags or text patterns
  // Flag emojis: 🇩🇪 DE, 🇳🇱 NL, 🇫🇮 FI, etc.
  const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
  const flagMatch = name.match(flagPattern);
  
  if (flagMatch) {
    // Convert flag emoji to country code
    const flag = flagMatch[0];
    const codePoints = [...flag].map(c => c.codePointAt(0)! - 0x1F1E6 + 65);
    return String.fromCharCode(...codePoints);
  }
  
  // Try text pattern: DE, NL, FI, US, etc.
  const textPattern = /\b([A-Z]{2})\b/;
  const textMatch = name.match(textPattern);
  if (textMatch) {
    const knownCodes = ['DE', 'NL', 'FI', 'US', 'CA', 'SE', 'TR', 'FR', 'GB', 'JP', 'KR', 'SG', 'AU', 'BR', 'IN', 'RU', 'IT', 'ES', 'AT', 'CH', 'IR'];
    if (knownCodes.includes(textMatch[1])) {
      return textMatch[1];
    }
  }
  
  return null;
}

export function extractGroupKey(name: string): string {
  const countryCode = extractCountryCode(name);
  if (countryCode) return countryCode;
  
  // Fallback: use first word
  const words = name.replace(/[^\w\s]/g, '').trim().split(/\s+/);
  return words[0] || 'Unknown';
}

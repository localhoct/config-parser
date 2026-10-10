import { parseProxyLink, ParsedProxy, extractGroupKey } from './proxyParser';

export interface SubscriptionData {
  proxies: ParsedProxy[];
  groups: Map<string, ParsedProxy[]>;
}

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];

export async function fetchSubscription(url: string): Promise<string> {
  // Try direct fetch first (works if server has CORS enabled)
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/plain, application/x-sqlite3, */*',
      },
    });
    if (response.ok) {
      const text = await response.text();
      // Check if it's actual subscription data (not HTML page)
      if (text.includes('://') && !text.includes('<html')) return text;
    }
  } catch {
    // Continue to CORS proxies
  }

  // Try CORS proxies
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        if (text.includes('://') && !text.includes('<html')) return text;
      }
    } catch {
      continue;
    }
  }

  throw new Error('خطا در دریافت ساب‌لینک. لطفاً لینک‌های خام را مستقیماً وارد کنید یا از CORS proxy استفاده کنید.');
}

export function decodeSubscription(raw: string): string[] {
  let decoded: string;
  
  // Try base64 decode
  try {
    // Remove whitespace and newlines
    const cleaned = raw.replace(/\s/g, '');
    decoded = atob(cleaned);
  } catch {
    // Not base64, use as-is
    decoded = raw;
  }
  
  // Split by newlines and filter empty lines
  const links = decoded
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && (
      l.startsWith('vless://') ||
      l.startsWith('vmess://') ||
      l.startsWith('trojan://') ||
      l.startsWith('ss://') ||
      l.startsWith('ssr://') ||
      l.startsWith('hysteria://') ||
      l.startsWith('hy2://') ||
      l.startsWith('tuic://') ||
      l.startsWith('wireguard://')
    ));
  
  return links;
}

export function parseSubscription(links: string[]): SubscriptionData {
  const proxies: ParsedProxy[] = [];
  const groups = new Map<string, ParsedProxy[]>();
  
  for (const link of links) {
    const proxy = parseProxyLink(link);
    if (proxy) {
      proxies.push(proxy);
      
      const groupKey = extractGroupKey(proxy.name);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(proxy);
    }
  }
  
  return { proxies, groups };
}

import { parseProxyLink, buildGroupKey, ParsedProxy } from './proxyParser';

export interface ConfigGroup {
  key: string;
  country: string;
  tag: string;
  isVIP: boolean;
  proxies: ParsedProxy[];
}

export interface SubscriptionData {
  proxies: ParsedProxy[];
  groups: Map<string, ConfigGroup>;
}

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];

export async function fetchSubscription(url: string): Promise<string> {
  // Replace forsubs with www
  const targetUrl = url.replace('forsubs.software4you.ir', 'www.software4you.ir');
  
  // Try direct fetch first
  try {
    const response = await fetch(targetUrl, {
      headers: { 'Accept': 'text/plain, */*' },
    });
    if (response.ok) {
      const text = await response.text();
      if (text.includes('://') && !text.includes('<html')) return text;
    }
  } catch {}

  // Try CORS proxies
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(targetUrl);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        if (text.includes('://') && !text.includes('<html')) return text;
      }
    } catch {
      continue;
    }
  }

  throw new Error('خطا در دریافت ساب‌لینک. لطفاً لینک‌های خام را مستقیماً وارد کنید.');
}

export function decodeSubscription(raw: string): string[] {
  let decoded: string;
  try {
    const cleaned = raw.replace(/\s/g, '');
    decoded = atob(cleaned);
  } catch {
    decoded = raw;
  }
  
  return decoded
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && (
      l.startsWith('vless://') ||
      l.startsWith('trojan://') ||
      l.startsWith('ss://')
    ));
}

export function parseSubscription(links: string[]): SubscriptionData {
  const proxies: ParsedProxy[] = [];
  const groups = new Map<string, ConfigGroup>();
  
  for (const link of links) {
    const proxy = parseProxyLink(link);
    if (proxy) {
      const { key, country, tag, isVIP } = buildGroupKey(proxy);
      proxy.countryCode = country;
      proxy.tag = tag;
      proxy.isVIP = isVIP;
      proxies.push(proxy);
      
      if (!groups.has(key)) {
        groups.set(key, { key, country, tag, isVIP, proxies: [] });
      }
      groups.get(key)!.proxies.push(proxy);
    }
  }
  
  return { proxies, groups };
}

// Config Merger Server - Reverse Proxy Mode
// سرور ترکیب کانفیگ‌ها با قابلیت Reverse Proxy کامل

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const TARGET_HOST = 'www.software4you.ir';

// ========== Performance settings ==========
// اتصال keep-alive به سرور اصلی: بدون handshake جدید TCP/TLS برای هر درخواست
const upstreamAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 100,
  maxFreeSockets: 20,
});
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_SECONDS || 15) * 1000;
// کش کوتاه‌مدت نتیجه‌ی ترکیب‌شده (0 = غیرفعال)
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_SECONDS || 30) * 1000;
const CACHE_MAX_ENTRIES = 500;

// ========== Country Flags ==========
const FLAGS = {
  'DE': '🇩🇪', 'NL': '🇳🇱', 'FI': '🇫🇮', 'US': '🇺🇸',
  'CA': '🇨🇦', 'SE': '🇸🇪', 'TR': '🇹🇷', 'FR': '🇫🇷',
  'GB': '🇬🇧', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
  'AU': '🇦🇺', 'BR': '🇧🇷', 'IN': '🇮🇳', 'RU': '🇷🇺',
  'IT': '🇮🇹', 'ES': '🇪🇸', 'AT': '🇦🇹', 'CH': '🇨🇭',
};

function getFlag(code, remarks) {
  if (remarks) {
    const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
    const flagMatch = remarks.match(flagPattern);
    if (flagMatch) return flagMatch[0];
  }
  const baseCode = code.replace(/\d+$/, '');
  return FLAGS[baseCode] || '🌐';
}

// ========== Country & Tag Extraction ==========
function extractCountry(remarks) {
  const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
  const flagMatch = remarks.match(flagPattern);
  let baseCode = null;
  
  if (flagMatch) {
    const codePoints = [...flagMatch[0]].map(c => c.codePointAt(0) - 0x1F1E6 + 65);
    baseCode = String.fromCharCode(...codePoints);
  }
  
  const countryCodePattern = /\b([A-Z]{2})(\d*)\b/;
  const match = remarks.match(countryCodePattern);
  
  if (match) {
    const code = match[1];
    const number = match[2];
    if (baseCode && code === baseCode) return number ? `${code}${number}` : code;
    if (!baseCode) return number ? `${code}${number}` : code;
  }
  
  if (baseCode) return baseCode;
  return 'OTHER';
}

function extractTag(remarks) {
  const bracketMatch = remarks.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  if (remarks.includes('~ Hamrah-Aval')) return 'Hamrah-Aval';
  return 'default';
}

function isVIP(remarks) {
  return remarks.includes('[VIP]');
}

function buildGroupKey(remarks) {
  const country = extractCountry(remarks);
  const tag = extractTag(remarks);
  const vip = isVIP(remarks);
  
  if (vip) {
    return { key: `VIP_${remarks.replace(/[^\w]/g, '_').slice(0, 30)}`, country, tag: 'VIP', isVIP: true };
  }
  return { key: `${country}_${tag}`, country, tag, isVIP: false };
}

// ========== Reverse Proxy (Full) ==========
// پاسخ بدون decompress و بدون تغییر هدرها (content-encoding / content-length) به کلاینت پاس داده می‌شود.
// به این ترتیب gzip / deflate / br / zstd همگی درست کار می‌کنند.
function proxyRequest(req, res) {
  const targetUrl = new URL(req.url, `https://${TARGET_HOST}`);

  console.log(`[PROXY] ${req.method} ${targetUrl.pathname}`);

  const headers = { ...req.headers };
  headers['host'] = TARGET_HOST;

  // هدرهایی که نباید فوروارد شوند
  delete headers['connection'];
  delete headers['keep-alive'];
  delete headers['transfer-encoding'];

  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: headers,
    agent: upstreamAgent,
    timeout: UPSTREAM_TIMEOUT_MS,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[PROXY] Response: ${proxyRes.statusCode} ${proxyRes.statusMessage} (${proxyRes.headers['content-type'] || '-'})`);

    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });

    proxyRes.on('error', (err) => {
      console.error('[PROXY] Stream error:', err.message);
      res.destroy();
    });
  });

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('Upstream timeout')));

  proxyReq.on('error', (err) => {
    console.error('[PROXY] Request error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Bad Gateway');
  });

  // بدنه‌ی درخواست (برای POST, PUT, ...)
  req.pipe(proxyReq, { end: true });
}

// ========== Subscription Processing ==========
function fetchSubscriptionData(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: TARGET_HOST,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      agent: upstreamAgent,
      timeout: UPSTREAM_TIMEOUT_MS,
    };
    
    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // بدنه‌ی پاسخ redirect را مصرف کن تا سوکت آزاد شود
        const redirectUrl = new URL(res.headers.location, `https://${TARGET_HOST}`);
        console.log(`[FETCH] Redirect to: ${redirectUrl.pathname}`);
        
        const redirectOptions = {
          hostname: redirectUrl.hostname,
          port: 443,
          path: redirectUrl.pathname + redirectUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
          agent: upstreamAgent,
          timeout: UPSTREAM_TIMEOUT_MS,
        };
        
        const redirectReq = https.request(redirectOptions, (redirectRes) => {
          processSubscriptionResponse(redirectRes, resolve, reject);
        });
        redirectReq.on('timeout', () => redirectReq.destroy(new Error('Upstream timeout')));
        redirectReq.on('error', reject);
        redirectReq.end();
        
        return;
      }
      
      processSubscriptionResponse(res, resolve, reject);
    });
    
    req.on('timeout', () => req.destroy(new Error('Upstream timeout')));
    req.on('error', reject);
    req.end();
  });
}

function processSubscriptionResponse(res, resolve, reject) {
  const chunks = [];
  
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const data = Buffer.concat(chunks).toString('utf-8');
    
    // Extract headers
    const headers = {};
    const headerKeys = [
      'subscription-userinfo',
      'profile-update-interval',
      'profile-title',
      'profile-web-page-url',
      'support-url',
      'content-disposition',
      'announce',
      'announce-url',
      'cache-control',
    ];
    
    headerKeys.forEach(key => {
      if (res.headers[key]) headers[key] = res.headers[key];
    });
    
    // Try JSON
    try {
      const configs = JSON.parse(data);
      resolve({ configs: Array.isArray(configs) ? configs : [configs], headers });
      return;
    } catch {}
    
    // Try base64
    try {
      const decoded = Buffer.from(data.replace(/\s/g, ''), 'base64').toString('utf-8');
      try {
        const configs = JSON.parse(decoded);
        resolve({ configs: Array.isArray(configs) ? configs : [configs], headers });
        return;
      } catch {}
      
      if (decoded.includes('://')) {
        const lines = decoded.split('\n').filter(line => line.trim().length > 0);
        resolve({ configs: parseProxyLinks(lines), headers });
        return;
      }
    } catch {}
    
    // Try plain text
    if (data.includes('://')) {
      const lines = data.split('\n').filter(line => line.trim().length > 0);
      resolve({ configs: parseProxyLinks(lines), headers });
      return;
    }
    
    reject(new Error('Failed to parse subscription data'));
  });
  
  res.on('error', reject);
}

// ========== Proxy Link Parsers ==========
function parseProxyLinks(lines) {
  const configs = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      if (trimmed.startsWith('vless://')) configs.push(parseVlessLink(trimmed));
      else if (trimmed.startsWith('trojan://')) configs.push(parseTrojanLink(trimmed));
      else if (trimmed.startsWith('ss://')) configs.push(parseSSLink(trimmed));
    } catch (err) {
      console.error('[PARSE] Failed:', trimmed.substring(0, 50), err.message);
    }
  }
  return configs;
}

function parseVlessLink(link) {
  const url = new URL(link);
  const params = url.searchParams;
  const security = params.get('security') || 'none';
  const type = params.get('type') || 'tcp';
  
  const outbound = {
    protocol: 'vless',
    tag: 'proxy',
    settings: {
      vnext: [{
        address: url.hostname,
        port: parseInt(url.port),
        users: [{
          id: url.username,
          encryption: params.get('encryption') || 'none',
          flow: params.get('flow') || '',
        }],
      }],
    },
    streamSettings: {
      network: type,
      sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' },
    },
  };
  
  if (security === 'tls') {
    outbound.streamSettings.security = 'tls';
    outbound.streamSettings.tlsSettings = {
      serverName: params.get('sni') || url.hostname,
      fingerprint: params.get('fp') || 'chrome',
      alpn: params.get('alpn') ? params.get('alpn').split(',') : ['h2', 'http/1.1'],
    };
  } else if (security === 'reality') {
    outbound.streamSettings.security = 'reality';
    outbound.streamSettings.realitySettings = {
      serverName: params.get('sni') || url.hostname,
      fingerprint: params.get('fp') || 'chrome',
      publicKey: params.get('pbk') || '',
      shortId: params.get('sid') || '',
    };
  }
  
  if (type === 'ws') {
    outbound.streamSettings.wsSettings = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host') } : {},
    };
  } else if (type === 'tcp') {
    outbound.streamSettings.tcpSettings = { header: { type: 'none' } };
  }
  
  return { remarks: decodeURIComponent(url.hash.slice(1)), outbounds: [outbound] };
}

function parseTrojanLink(link) {
  const url = new URL(link);
  const params = url.searchParams;
  const security = params.get('security') || 'tls';
  const type = params.get('type') || 'tcp';
  
  const outbound = {
    protocol: 'trojan',
    tag: 'proxy',
    settings: {
      servers: [{
        address: url.hostname,
        port: parseInt(url.port),
        password: url.username,
      }],
    },
    streamSettings: {
      network: type,
      security: security,
      sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' },
    },
  };
  
  if (security === 'tls') {
    outbound.streamSettings.tlsSettings = {
      serverName: params.get('sni') || url.hostname,
      fingerprint: params.get('fp') || 'chrome',
    };
  }
  
  if (type === 'ws') {
    outbound.streamSettings.wsSettings = {
      path: params.get('path') || '/',
      headers: params.get('host') ? { Host: params.get('host') } : {},
    };
  } else if (type === 'tcp') {
    outbound.streamSettings.tcpSettings = { header: { type: 'none' } };
  }
  
  return { remarks: decodeURIComponent(url.hash.slice(1)), outbounds: [outbound] };
}

function parseSSLink(link) {
  const url = new URL(link);
  let method, password;
  try {
    const decoded = Buffer.from(url.username, 'base64').toString('utf-8');
    [method, password] = decoded.split(':');
  } catch {
    method = url.username;
    password = '';
  }
  
  const outbound = {
    protocol: 'shadowsocks',
    tag: 'proxy',
    settings: {
      servers: [{
        address: url.hostname,
        port: parseInt(url.port),
        method: method || 'aes-256-gcm',
        password: password,
      }],
    },
    streamSettings: {
      sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' },
    },
  };
  
  return { remarks: decodeURIComponent(url.hash.slice(1)), outbounds: [outbound] };
}

// ========== Config Builders ==========
function buildMergedConfig(country, tag, configs) {
  const flag = getFlag(country, configs[0] ? configs[0].remarks : '');
  const outbounds = [];
  const proxyTags = [];

  configs.forEach((config, index) => {
    if (config.outbounds && config.outbounds.length > 0) {
      const outbound = config.outbounds.find(o => o.tag === 'proxy' || o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks');
      if (outbound) {
        const tag_name = index === 0 ? 'proxy' : `proxy-${index + 1}`;
        const newOutbound = JSON.parse(JSON.stringify(outbound));
        newOutbound.tag = tag_name;
        outbounds.push(newOutbound);
        proxyTags.push(tag_name);
      }
    }
  });

  outbounds.push({ tag: 'DIRECT', protocol: 'freedom', settings: {} });
  outbounds.push({ tag: 'BLOCK', protocol: 'blackhole', settings: { response: { type: 'http' } } });

  return {
    remarks: `${flag} ${country} [${tag}]`,
    log: { loglevel: 'warning' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [
      { tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { udp: true, auth: 'noauth' }, sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
      { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
    ],
    outbounds,
    routing: {
      domainStrategy: 'AsIs',
      balancers: proxyTags.length > 1 ? [{
        tag: 'auto',
        selector: proxyTags,
        fallbackTag: proxyTags[0],
        strategy: { type: 'leastLoad', settings: { baselines: ['200ms', '500ms', '1s'], expected: 2, maxRTT: '3s', tolerance: 0.05 } },
      }] : undefined,
      rules: proxyTags.length > 1
        ? [{ type: 'field', network: 'tcp,udp', balancerTag: 'auto' }]
        : [{ type: 'field', network: 'tcp,udp', outboundTag: proxyTags[0] }],
    },
    policy: { levels: { '0': { timeout: { handshake: 8, connIdle: 300, uplinkOnly: 10, downlinkOnly: 30 } } } },
    burstObservatory: {
      subjectSelector: ['proxy'],
      pingConfig: { destination: 'http://cp.cloudflare.com/generate_204', interval: '3m', timeout: '5s', sampling: 2 },
    },
  };
}

function buildSingleConfig(config) {
  const outbound = config.outbounds ? config.outbounds.find(o => o.tag === 'proxy' || o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks') : null;
  if (!outbound) return config;

  const newOutbound = JSON.parse(JSON.stringify(outbound));
  newOutbound.tag = 'proxy';
  const flag = getFlag(extractCountry(config.remarks || ''), config.remarks);

  return {
    remarks: config.remarks || `${flag} VIP Config`,
    log: { loglevel: 'warning' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [
      { tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { udp: true, auth: 'noauth' }, sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
      { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
    ],
    outbounds: [newOutbound, { tag: 'DIRECT', protocol: 'freedom', settings: {} }, { tag: 'BLOCK', protocol: 'blackhole', settings: { response: { type: 'http' } } }],
    routing: { domainStrategy: 'AsIs', rules: [{ type: 'field', network: 'tcp,udp', outboundTag: 'proxy' }] },
    policy: { levels: { '0': { timeout: { handshake: 8, connIdle: 300, uplinkOnly: 10, downlinkOnly: 30 } } } },
  };
}

// ========== Config Processing ==========
function isProxyConfig(config) {
  if (!config.outbounds || config.outbounds.length === 0) return false;
  return !!config.outbounds.find(o => o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks' || o.protocol === 'vmess');
}

// کانفیگ‌های وضعیت/اطلاعات کاربر (نه سرور واقعی):
// حجم، تاریخ، نام کاربر، و پیام‌هایی مثل «حجم/زمان سرویس شما به پایان رسیده است».
// این‌ها هرگز نباید گروه‌بندی یا ترکیب شوند و باید دقیقاً بدون تغییر عبور کنند.
//
// ملاک اصلی «آدرس ساختگی» (۰.۰.۰.۰) است، چون ایموجی‌ها در remark قابل تنظیم‌اند
// و ممکن است روی سرورهای واقعی هم باشند (مثلاً «vless-ws Server {STATUS_EMOJI}»).
const DATA_DATE_EMOJIS = ['⏳', '📅'];                       // قالب‌های {DATA_USAGE} و {TIME_LEFT}
const STATUS_EMOJIS = ['✅', '⌛', '🪫', '❌', '🔌'];          // مقادیر {STATUS_EMOJI}

function findAddress(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return '';
  if (typeof node.address === 'string' && node.address) return node.address;
  for (const v of (Array.isArray(node) ? node : Object.values(node))) {
    const found = findAddress(v, depth + 1);
    if (found) return found;
  }
  return '';
}

function getOutboundAddress(config) {
  const outbound = (config.outbounds || []).find(o =>
    ['vless', 'vmess', 'trojan', 'shadowsocks'].includes(o.protocol));
  return outbound ? findAddress(outbound.settings) : '';
}

function isPlaceholderAddress(addr) {
  return /^(0\.0\.0\.\d+|127\.\d+\.\d+\.\d+|localhost)$/i.test(addr);
}

function isUserInfoConfig(config) {
  if (!isProxyConfig(config)) return true;

  const remarks = config.remarks || '';
  const addr = getOutboundAddress(config);

  if (addr && isPlaceholderAddress(addr)) return true;               // آدرس ساختگی → کانفیگ نمایشی
  if (DATA_DATE_EMOJIS.some(e => remarks.includes(e))) return true;  // حجم / تاریخ
  if (!addr && STATUS_EMOJIS.some(e => remarks.includes(e))) return true; // آدرس قابل خواندن نیست → ایموجی وضعیت
  return false;
}

function processConfigs(configs) {
  const groups = new Map();
  const passthroughConfigs = [];

  for (const config of configs) {
    if (!config.remarks) continue;
    if (isUserInfoConfig(config) || !isProxyConfig(config)) {
      passthroughConfigs.push(config);
      continue;
    }
    
    const { key, country, tag, isVIP } = buildGroupKey(config.remarks);
    if (!groups.has(key)) groups.set(key, { key, country, tag, isVIP, configs: [] });
    groups.get(key).configs.push(config);
  }

  const result = [];
  for (const group of groups.values()) {
    if (group.isVIP) {
      for (const config of group.configs) result.push(buildSingleConfig(config));
    } else {
      result.push(buildMergedConfig(group.country, group.tag, group.configs));
    }
  }
  
  for (const config of passthroughConfigs) result.push(config);
  return result;
}

// ========== HTTP Server ==========
// ========== Cache + In-flight dedupe ==========
// - اگر چند درخواست همزمان برای یک توکن بیاید، فقط یک درخواست به سرور اصلی زده می‌شود
// - نتیجه‌ی ترکیب‌شده CACHE_TTL_MS ثانیه کش می‌شود (پردازش و fetch تکراری حذف می‌شود)
const subCache = new Map();   // key -> { body, headers, expires }
const inflight = new Map();   // key -> Promise<entry>

function getMergedResponse(key) {
  const hit = subCache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit);

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const { configs, headers } = await fetchSubscriptionData(key);
    console.log(`[CLIENT] Received ${configs.length} configs`);
    const merged = processConfigs(configs);
    console.log(`[CLIENT] Generated ${merged.length} merged configs`);

    const entry = {
      body: Buffer.from(JSON.stringify(merged)), // بدون indent: کوچک‌تر و سریع‌تر
      headers,
      expires: Date.now() + CACHE_TTL_MS,
    };

    if (CACHE_TTL_MS > 0) {
      subCache.set(key, entry);
      while (subCache.size > CACHE_MAX_ENTRIES) {
        subCache.delete(subCache.keys().next().value);
      }
    }
    return entry;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

// پاک‌سازی دوره‌ای ورودی‌های منقضی
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of subCache) if (v.expires <= now) subCache.delete(k);
}, 60000).unref();

function isBrowserRequest(req) {
  return (req.headers['accept'] || '').includes('text/html');
}

// فقط خودِ لینک ساب (/sub/<token>) پردازش می‌شود؛
// مسیرهای فرعی مثل /info /links /apps /usage همیشه پروکسی می‌شوند.
const SUB_ROOT = /^\/sub\/[^/?#]+\/?(?:\?.*)?$/;

function isConfigRequest(req) {
  return SUB_ROOT.test(req.url) && !isBrowserRequest(req);
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Client request on /sub/<token> → Process & merge configs
  if (isConfigRequest(req)) {
    console.log(`[CLIENT] ${req.url.slice(0, 40)}...`);

    try {
      const { body, headers } = await getMergedResponse(req.url);

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="merged-configs.json"',
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
        ...headers,
      });
      res.end(body);
    } catch (error) {
      console.error('[CLIENT] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Everything else (browser HTML + /info /links /apps /usage + any other path) → Reverse proxy
  proxyRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Config Merger Server`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🎯 Target: ${TARGET_HOST}`);
  console.log(`\n📖 Usage:`);
  console.log(`   Browser: http://localhost:${PORT}/sub/<path>`);
  console.log(`   Client:  curl -H "Accept: application/json" http://localhost:${PORT}/sub/<path>`);
  console.log(`\n✨ Features:`);
  console.log(`   • Browser requests + panel APIs → Reverse proxy to original server`);
  console.log(`   • Client requests → Process & merge configs`);
  console.log(`   • Country-based grouping with balancer`);
  console.log(`   • VIP configs preserved`);
  console.log(`\n`);
});

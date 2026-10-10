// Config Merger Server - Reverse Proxy Mode
// سرور ترکیب کانفیگ‌ها با قابلیت Reverse Proxy کامل

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const TARGET_HOST = 'www.software4you.ir';

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

// ========== Redirect to Original Server ==========
function redirectToOriginal(req, res) {
  const targetUrl = `https://${TARGET_HOST}${req.url}`;
  
  console.log(`[REDIRECT] Browser request → Redirecting to: ${targetUrl}`);
  
  res.writeHead(302, {
    'Location': targetUrl,
    'Cache-Control': 'no-store'
  });
  res.end();
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
    };
    
    const req = https.request(options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
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
        };
        
        https.request(redirectOptions, (redirectRes) => {
          processSubscriptionResponse(redirectRes, resolve, reject);
        }).on('error', reject).end();
        
        return;
      }
      
      processSubscriptionResponse(res, resolve, reject);
    });
    
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

function isUserInfoConfig(config) {
  if (!isProxyConfig(config)) return true;
  const remarks = config.remarks || '';
  return remarks.includes('⏳') || remarks.includes('📅') || remarks.includes('✅');
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
function isBrowserRequest(req) {
  return (req.headers['accept'] || '').includes('text/html');
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

  // Subscription endpoint
  if (req.url.startsWith('/sub/')) {
    // Browser request → Redirect to original server
    if (isBrowserRequest(req)) {
      redirectToOriginal(req, res);
      return;
    }
    
    // Client request → Process configs
    console.log(`[CLIENT] Processing mode`);
    
    try {
      const { configs, headers } = await fetchSubscriptionData(req.url);
      console.log(`[CLIENT] Received ${configs.length} configs`);
      
      const merged = processConfigs(configs);
      console.log(`[CLIENT] Generated ${merged.length} merged configs`);

      const responseHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="merged-configs.json"',
        'Cache-Control': 'no-store',
        ...headers,
      };
      
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify(merged, null, 2));
    } catch (error) {
      console.error('[CLIENT] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Default: Redirect to original server for all other paths
  console.log(`[DEFAULT] Redirect to original server for ${req.url}`);
  redirectToOriginal(req, res);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Config Merger Server`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🎯 Target: ${TARGET_HOST}`);
  console.log(`\n📖 Usage:`);
  console.log(`   Browser: http://localhost:${PORT}/sub/<path>`);
  console.log(`   Client:  curl -H "Accept: application/json" http://localhost:${PORT}/sub/<path>`);
  console.log(`\n✨ Features:`);
  console.log(`   • Browser requests → Redirect to original server`);
  console.log(`   • Client requests → Process & merge configs`);
  console.log(`   • Country-based grouping with balancer`);
  console.log(`   • VIP configs preserved`);
  console.log(`\n`);
});

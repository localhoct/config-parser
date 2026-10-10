// Config Merger Server
// سرور ترکیب کانفیگ‌ها بر اساس کشور و تگ با balancer leastLoad

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

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

// ========== HTTP Requests ==========
function fetchHtmlPage(path, reqHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = `https://www.software4you.ir${path}`;
    
    // Pass through browser headers
    const headers = {
      'User-Agent': reqHeaders['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': reqHeaders['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': reqHeaders['accept-language'] || 'en-US,en;q=0.9,fa;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': reqHeaders['sec-fetch-dest'] || 'document',
      'Sec-Fetch-Mode': reqHeaders['sec-fetch-mode'] || 'navigate',
      'Sec-Fetch-Site': reqHeaders['sec-fetch-site'] || 'none',
      'Sec-Fetch-User': reqHeaders['sec-fetch-user'] || '?1',
    };
    
    // Add Referer if exists
    if (reqHeaders['referer']) headers['Referer'] = reqHeaders['referer'];
    
    const options = {
      method: 'GET',
      headers: headers,
      followRedirects: true,
    };
    
    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        const redirectUrl = new URL(res.headers.location, url);
        https.get(redirectUrl.toString(), options, (redirectRes) => {
          let data = '';
          redirectRes.on('data', chunk => data += chunk);
          redirectRes.on('end', () => {
            resolve({ 
              html: data, 
              statusCode: redirectRes.statusCode,
              headers: redirectRes.headers
            });
          });
        }).on('error', reject);
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ 
          html: data, 
          statusCode: res.statusCode,
          headers: res.headers
        });
      });
    }).on('error', reject);
  });
}

function fetchSubscription(path) {
  return new Promise((resolve, reject) => {
    const url = `https://www.software4you.ir${path}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url);
        https.get(redirectUrl.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } }, (redirectRes) => {
          processSubscriptionResponse(redirectRes, resolve, reject);
        }).on('error', reject);
        return;
      }
      
      processSubscriptionResponse(res, resolve, reject);
    }).on('error', reject);
  });
}

function processSubscriptionResponse(res, resolve, reject) {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Extract ALL important headers from original server
    const originalHeaders = {};
    
    // Copy all relevant headers
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
      'content-type',
    ];
    
    headerKeys.forEach(key => {
      if (res.headers[key]) {
        originalHeaders[key] = res.headers[key];
      }
    });
    
    // Try JSON
    try {
      const configs = JSON.parse(data);
      resolve({ configs: Array.isArray(configs) ? configs : [configs], headers: originalHeaders });
      return;
    } catch {}
    
    // Try base64
    try {
      const decoded = Buffer.from(data.replace(/\s/g, ''), 'base64').toString('utf-8');
      try {
        const configs = JSON.parse(decoded);
        resolve({ configs: Array.isArray(configs) ? configs : [configs], headers: originalHeaders });
        return;
      } catch {}
      
      if (decoded.includes('://')) {
        const lines = decoded.split('\n').filter(line => line.trim().length > 0);
        resolve({ configs: parseProxyLinks(lines), headers: originalHeaders });
        return;
      }
    } catch {}
    
    // Try plain text
    if (data.includes('://')) {
      const lines = data.split('\n').filter(line => line.trim().length > 0);
      resolve({ configs: parseProxyLinks(lines), headers: originalHeaders });
      return;
    }
    
    reject(new Error('Failed to parse subscription data - unknown format'));
  });
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
      console.error('Failed to parse link:', trimmed.substring(0, 50), err.message);
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
  const flag = getFlag(country, configs[0]?.remarks);
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
  const outbound = config.outbounds?.find(o => o.tag === 'proxy' || o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks');
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.url.startsWith('/sub/')) {
    try {
      const path = req.url;
      const isBrowser = isBrowserRequest(req);
      console.log(`Request from: ${isBrowser ? 'Browser' : 'Client'} - ${path}`);
      
      if (isBrowser) {
        console.log(`Fetching HTML page from: https://www.software4you.ir${path}`);
        try {
          // Pass browser headers to original server
          const { html, statusCode, headers } = await fetchHtmlPage(path, req.headers);
          
          // Build response headers - pass through ALL headers from original server
          const responseHeaders = {};
          
          // Copy all headers from original response
          Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              // Skip hop-by-hop headers
              const skipHeaders = ['transfer-encoding', 'connection', 'keep-alive', 'te', 'trailer', 'upgrade'];
              if (!skipHeaders.includes(key.toLowerCase())) {
                responseHeaders[key] = value;
              }
            }
          });
          
          // Ensure Content-Type is set
          if (!responseHeaders['content-type']) {
            responseHeaders['Content-Type'] = 'text/html; charset=utf-8';
          }
          
          console.log(`Returning HTML page with status ${statusCode}`);
          res.writeHead(statusCode || 200, responseHeaders);
          res.end(html);
        } catch (err) {
          console.error('Failed to fetch HTML page:', err.message);
          res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>Error</title></head><body><h1>⚠️ سرور اصلی در دسترس نیست</h1></body></html>`);
        }
        return;
      }
      
      console.log(`Fetching subscription from: https://www.software4you.ir${path}`);
      const { configs, headers: originalHeaders } = await fetchSubscription(path);
      console.log(`Received ${configs.length} configs`);
      
      const merged = processConfigs(configs);
      console.log(`Generated ${merged.length} merged configs`);

      const responseHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="merged-configs.json"',
        'Cache-Control': 'no-store',
      };
      
      Object.entries(originalHeaders).forEach(([key, value]) => {
        if (value) responseHeaders[key] = value;
      });
      
      res.writeHead(200, responseHeaders);
      res.end(JSON.stringify(merged, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Config Merger Server running on port ${PORT}`);
  console.log(`Usage: http://localhost:${PORT}/sub/<your-subscription-path>`);
});

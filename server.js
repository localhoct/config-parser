// Config Merger Server
// یک سرور ساده که ساب‌لینک را دریافت و کانفیگ‌ها را ترکیب می‌کند

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

const FLAGS = {
  'DE': '🇩🇪', 'NL': '🇳🇱', 'FI': '🇫🇮', 'US': '🇺🇸',
  'CA': '🇨🇦', 'SE': '🇸🇪', 'TR': '🇹🇷', 'FR': '🇫🇷',
  'GB': '🇬🇧', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
  'AU': '🇦🇺', 'BR': '🇧🇷', 'IN': '🇮🇳', 'RU': '🇷🇺',
  'IT': '🇮🇹', 'ES': '🇪🇸', 'AT': '🇦🇹', 'CH': '🇨🇭',
};

function getFlag(code, remarks) {
  // First, try to extract flag emoji from original remarks
  if (remarks) {
    const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
    const flagMatch = remarks.match(flagPattern);
    if (flagMatch) {
      return flagMatch[0];
    }
  }
  
  // Extract base country code (remove numbers)
  const baseCode = code.replace(/\d+$/, '');
  
  // Return flag for base code
  return FLAGS[baseCode] || '🌐';
}

// Extract country code from remarks (including numbers like DE2, DE3, NL5, etc.)
function extractCountry(remarks) {
  // First, try to extract base country code from flag emoji
  const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
  const flagMatch = remarks.match(flagPattern);
  let baseCode = null;
  
  if (flagMatch) {
    const codePoints = [...flagMatch[0]].map(c => c.codePointAt(0) - 0x1F1E6 + 65);
    baseCode = String.fromCharCode(...codePoints);
  }
  
  // Now search for country code pattern: 2 letters + optional number
  // This works for all countries, not just a predefined list
  const countryCodePattern = /\b([A-Z]{2})(\d*)\b/;
  const match = remarks.match(countryCodePattern);
  
  if (match) {
    const code = match[1];
    const number = match[2];
    
    // If we have a base code from flag, verify it matches
    if (baseCode && code === baseCode) {
      return number ? `${code}${number}` : code;
    }
    
    // If no flag or codes don't match, use the text pattern
    if (!baseCode) {
      return number ? `${code}${number}` : code;
    }
  }
  
  // Fallback to flag emoji base code
  if (baseCode) {
    return baseCode;
  }
  
  return 'OTHER';
}

// Extract tag from remarks
function extractTag(remarks) {
  const bracketMatch = remarks.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  if (remarks.includes('~ Hamrah-Aval')) return 'Hamrah-Aval';
  return 'default';
}

// Check if VIP
function isVIP(remarks) {
  return remarks.includes('[VIP]');
}

// Build group key
function buildGroupKey(remarks) {
  const country = extractCountry(remarks);
  const tag = extractTag(remarks);
  const vip = isVIP(remarks);
  
  if (vip) {
    return { key: `VIP_${remarks.replace(/[^\w]/g, '_').slice(0, 30)}`, country, tag: 'VIP', isVIP: true };
  }
  
  return { key: `${country}_${tag}`, country, tag, isVIP: false };
}

// Fetch subscription from www.software4you.ir
function fetchSubscription(path) {
  return new Promise((resolve, reject) => {
    const url = `https://www.software4you.ir${path}`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Try to parse as JSON
          const configs = JSON.parse(data);
          resolve(Array.isArray(configs) ? configs : [configs]);
        } catch {
          // Try base64 decode
          try {
            const decoded = Buffer.from(data.replace(/\s/g, ''), 'base64').toString('utf-8');
            const configs = JSON.parse(decoded);
            resolve(Array.isArray(configs) ? configs : [configs]);
          } catch {
            reject(new Error('Failed to parse subscription data'));
          }
        }
      });
    }).on('error', reject);
  });
}

// Build merged config with balancer
function buildMergedConfig(country, tag, configs) {
  // Get flag from first config's remarks
  const flag = getFlag(country, configs[0]?.remarks);
  const outbounds = [];
  const proxyTags = [];

  configs.forEach((config, index) => {
    // Extract outbound from original config
    if (config.outbounds && config.outbounds.length > 0) {
      const outbound = config.outbounds.find(o => o.tag === 'proxy' || o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks');
      if (outbound) {
        const tag_name = index === 0 ? 'proxy' : `proxy-${index + 1}`;
        // Deep copy - keep original config exactly as is (including finalmask if exists)
        const newOutbound = JSON.parse(JSON.stringify(outbound));
        newOutbound.tag = tag_name;
        
        // DO NOT modify finalmask - keep whatever the original config had
        
        outbounds.push(newOutbound);
        proxyTags.push(tag_name);
      }
    }
  });

  // Add DIRECT and BLOCK
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
        strategy: {
          type: 'leastLoad',
          settings: { baselines: ['200ms', '500ms', '1s'], expected: 2, maxRTT: '3s', tolerance: 0.05 },
        },
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

// Build single config (for VIP or user info)
function buildSingleConfig(config) {
  // If no proxy outbound, return as is (user info, expired, etc.)
  const outbound = config.outbounds?.find(o => o.tag === 'proxy' || o.protocol === 'vless' || o.protocol === 'trojan' || o.protocol === 'shadowsocks');
  if (!outbound) {
    // Return config exactly as is (user info, usage stats, expired configs)
    return config;
  }

  // Deep copy - keep original config exactly as is (including finalmask if exists)
  const newOutbound = JSON.parse(JSON.stringify(outbound));
  newOutbound.tag = 'proxy';
  
  // DO NOT modify finalmask - keep whatever the original config had

  // Get flag from original remarks
  const flag = getFlag(extractCountry(config.remarks || ''), config.remarks);

  return {
    remarks: config.remarks || `${flag} VIP Config`,
    log: { loglevel: 'warning' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [
      { tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { udp: true, auth: 'noauth' }, sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
      { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
    ],
    outbounds: [
      newOutbound,
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: { response: { type: 'http' } } },
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [{ type: 'field', network: 'tcp,udp', outboundTag: 'proxy' }],
    },
    policy: { levels: { '0': { timeout: { handshake: 8, connIdle: 300, uplinkOnly: 10, downlinkOnly: 30 } } } },
  };
}

// Check if config is a proxy config (has outbound with proxy protocol)
function isProxyConfig(config) {
  if (!config.outbounds || config.outbounds.length === 0) return false;
  
  // Check if has proxy protocol outbound
  const proxyOutbound = config.outbounds.find(o => 
    o.protocol === 'vless' || 
    o.protocol === 'trojan' || 
    o.protocol === 'shadowsocks' ||
    o.protocol === 'vmess'
  );
  
  return !!proxyOutbound;
}

// Check if config is a user info config (usage, expiry, etc.)
function isUserInfoConfig(config) {
  // If no proxy outbound, it's likely user info
  if (!isProxyConfig(config)) return true;
  
  // Check remarks for user info patterns
  const remarks = config.remarks || '';
  if (remarks.includes('⏳') || remarks.includes('📅') || remarks.includes('✅')) {
    return true;
  }
  
  return false;
}

// Process configs
function processConfigs(configs) {
  const groups = new Map();
  const passthroughConfigs = []; // Configs that should pass through unchanged

  for (const config of configs) {
    if (!config.remarks) continue;
    
    // Check if this is a user info config (usage, expiry, etc.)
    if (isUserInfoConfig(config)) {
      // User info config - keep as is (volume, expiry, username, etc.)
      passthroughConfigs.push(config);
      continue;
    }
    
    // Check if this is a proxy config
    if (!isProxyConfig(config)) {
      // Not a proxy config - keep as is
      passthroughConfigs.push(config);
      continue;
    }
    
    // This is a proxy config - group by country and tag
    const { key, country, tag, isVIP } = buildGroupKey(config.remarks);
    
    if (!groups.has(key)) {
      groups.set(key, { key, country, tag, isVIP, configs: [] });
    }
    groups.get(key).configs.push(config);
  }

  // Build final configs
  const result = [];
  
  // Add merged/VIP proxy configs
  for (const group of groups.values()) {
    if (group.isVIP) {
      // VIP: single config
      for (const config of group.configs) {
        result.push(buildSingleConfig(config));
      }
    } else {
      // Merged: all configs in group
      result.push(buildMergedConfig(group.country, group.tag, group.configs));
    }
  }
  
  // Add passthrough configs (user info, usage stats, expired configs, etc.) unchanged
  for (const config of passthroughConfigs) {
    result.push(config);
  }

  return result;
}

// Check if request is from browser (Accept: text/html)
function isBrowserRequest(req) {
  const acceptHeader = req.headers['accept'] || '';
  return acceptHeader.includes('text/html');
}

// Fetch HTML page from original server (for browser requests)
function fetchHtmlPage(path) {
  return new Promise((resolve, reject) => {
    const url = `https://www.software4you.ir${path}`;
    
    https.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      } 
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ html: data, headers: res.headers });
      });
    }).on('error', reject);
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS headers
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
    try {
      const path = req.url;
      const isBrowser = isBrowserRequest(req);
      
      console.log(`Request from: ${isBrowser ? 'Browser' : 'Client'} - ${path}`);
      
      // If browser request, fetch and return HTML page from original server
      if (isBrowser) {
        console.log(`Fetching HTML page from: https://www.software4you.ir${path}`);
        try {
          const { html, headers } = await fetchHtmlPage(path);
          
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(html);
        } catch (err) {
          // Fallback: show simple info page if original server is unavailable
          console.error('Failed to fetch HTML page:', err.message);
          const fallbackHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Info</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; text-align: center; }
    .card { max-width: 500px; margin: 2rem auto; padding: 2rem; background: #1e293b; border-radius: 1rem; border: 1px solid #334155; }
    h1 { color: #60a5fa; }
    p { color: #94a3b8; line-height: 1.6; }
    code { background: #0f172a; padding: 0.5rem; border-radius: 0.5rem; display: block; margin: 1rem 0; direction: ltr; text-align: left; font-size: 0.8rem; overflow-x: auto; }
    .status { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔗 Subscription</h1>
    <p class="status">⚠️ سرور اصلی در حال حاضر در دسترس نیست</p>
    <p>لطفاً بعداً دوباره تلاش کنید یا از کلاینت مستقیماً استفاده کنید.</p>
    <code>${req.url}</code>
  </div>
</body>
</html>`;
          res.writeHead(503, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(fallbackHtml);
        }
        return;
      }
      
      // If client request, fetch and process configs
      console.log(`Fetching subscription from: https://www.software4you.ir${path}`);
      
      const configs = await fetchSubscription(path);
      console.log(`Received ${configs.length} configs`);
      
      const merged = processConfigs(configs);
      console.log(`Generated ${merged.length} merged configs`);

      // Return as JSON array
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="merged-configs.json"',
        'Profile-Update-Interval': '24',
      });
      res.end(JSON.stringify(merged, null, 2));
    } catch (error) {
      console.error('Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Config Merger Server running on port ${PORT}`);
  console.log(`Usage: http://localhost:${PORT}/sub/<your-subscription-path>`);
  console.log(`Example: http://localhost:${PORT}/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4`);
});

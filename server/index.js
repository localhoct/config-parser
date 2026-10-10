// server/index.js - Backend for Config Merger
// Run: node server/index.js
// Requires: npm install express cors node-fetch

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(join(__dirname, '..', 'dist')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fetch and merge subscription
app.get('/api/sub/merge', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Fetch subscription
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'v2rayN/6.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.status}`);
    }

    const rawText = await response.text();
    
    // Decode base64 if needed
    let links;
    try {
      const decoded = Buffer.from(rawText.replace(/\s/g, ''), 'base64').toString('utf-8');
      links = decoded.split('\n').filter(l => l.trim().length > 0);
    } catch {
      links = rawText.split('\n').filter(l => l.trim().length > 0);
    }

    // Filter valid proxy links
    const proxyLinks = links.filter(l => 
      l.startsWith('vless://') || 
      l.startsWith('vmess://') || 
      l.startsWith('trojan://') || 
      l.startsWith('ss://')
    );

    if (proxyLinks.length === 0) {
      return res.status(404).json({ error: 'No valid proxy links found' });
    }

    // Parse and group by country
    const groups = {};
    
    for (const link of proxyLinks) {
      try {
        const parsed = parseProxyLink(link);
        if (parsed) {
          const countryCode = extractCountry(parsed.name);
          if (!groups[countryCode]) {
            groups[countryCode] = [];
          }
          groups[countryCode].push(parsed);
        }
      } catch (e) {
        // Skip invalid links
        continue;
      }
    }

    // Build configs for each group
    const result = {};
    for (const [code, proxies] of Object.entries(groups)) {
      result[code] = {
        count: proxies.length,
        config: buildConfig(code, proxies),
      };
    }

    res.json({ 
      total: proxyLinks.length,
      groups: Object.keys(result).length,
      configs: result 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single country config (raw JSON for Xray clients)
app.get('/api/sub/config/:country', async (req, res) => {
  const { country } = req.params;
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'v2rayN/6.0' },
    });
    
    const rawText = await response.text();
    let links;
    try {
      const decoded = Buffer.from(rawText.replace(/\s/g, ''), 'base64').toString('utf-8');
      links = decoded.split('\n').filter(l => l.trim().length > 0);
    } catch {
      links = rawText.split('\n').filter(l => l.trim().length > 0);
    }

    const proxyLinks = links.filter(l => 
      l.startsWith('vless://') || l.startsWith('vmess://') || 
      l.startsWith('trojan://') || l.startsWith('ss://')
    );

    const proxies = [];
    for (const link of proxyLinks) {
      try {
        const parsed = parseProxyLink(link);
        if (parsed && extractCountry(parsed.name) === country.toUpperCase()) {
          proxies.push(parsed);
        }
      } catch { continue; }
    }

    if (proxies.length === 0) {
      return res.status(404).json({ error: `No proxies found for country: ${country}` });
    }

    const config = buildConfig(country.toUpperCase(), proxies);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${country}-config.json"`);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// Helper functions
function parseProxyLink(link) {
  if (link.startsWith('vless://')) {
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
    };
  }
  
  if (link.startsWith('trojan://')) {
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
    };
  }
  
  if (link.startsWith('ss://')) {
    const url = new URL(link);
    let method, password;
    try {
      const decoded = Buffer.from(url.username, 'base64').toString('utf-8');
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
    };
  }
  
  return null;
}

function extractCountry(name) {
  // Extract from flag emoji
  const flagPattern = /[\u{1F1E0}-\u{1F1FF}]{2}/u;
  const flagMatch = name.match(flagPattern);
  if (flagMatch) {
    const codePoints = [...flagMatch[0]].map(c => c.codePointAt(0) - 0x1F1E6 + 65);
    return String.fromCharCode(...codePoints);
  }
  
  // Extract from text
  const knownCodes = ['DE', 'NL', 'FI', 'US', 'CA', 'SE', 'TR', 'FR', 'GB', 'JP', 'KR', 'SG', 'AU', 'BR', 'IN', 'RU', 'IT', 'ES', 'AT', 'CH'];
  for (const code of knownCodes) {
    if (name.includes(code)) return code;
  }
  
  return 'OTHER';
}

// FinalMask templates
const FINALMASK_TEMPLATES = {
  pop3: {
    tcp: [{
      type: 'header-custom',
      settings: {
        clients: [[], [{ type: 'str', packet: 'CAPA\r\n' }], [{ type: 'str', packet: 'STLS\r\n' }]],
        servers: [
          [{ type: 'str', packet: '+OK Dovecot (Ubuntu) ready.\r\n' }],
          [{ type: 'str', packet: '+OK\r\nCAPA\r\nTOP\r\nUIDL\r\nRESP-CODES\r\nPIPELINING\r\nAUTH-RESP-CODE\r\nSTLS\r\nUSER\r\nSASL PLAIN LOGIN\r\n.\r\n' }],
          [{ type: 'str', packet: '+OK Begin TLS negotiation now.\r\n' }],
        ],
      },
    }],
  },
  smtp: {
    tcp: [{
      type: 'header-custom',
      settings: {
        clients: [
          [],
          [{ type: 'str', packet: 'EHLO ' }, { type: 'str', packet: 'mailhost' }, { type: 'str', packet: '.example.org\r\n' }],
          [{ type: 'str', packet: 'STARTTLS\r\n' }],
        ],
        servers: [
          [
            { type: 'str', packet: '220 mail.example.net ESMTP Exim 4.96 Mon, 05 Oct 2026 ' },
            { rand: 1, randRange: '48-49' }, { rand: 1, randRange: '48-57' },
            { type: 'str', packet: ':' },
            { rand: 1, randRange: '48-53' }, { rand: 1, randRange: '48-57' },
            { type: 'str', packet: ':' },
            { rand: 1, randRange: '48-53' }, { rand: 1, randRange: '48-57' },
            { type: 'str', packet: ' +0000\r\n' },
          ],
          [
            { type: 'str', packet: '250-mail.example.net Hello ' },
            { type: 'str', packet: 'mailhost' },
            { type: 'str', packet: '.example.org [198.51.100.' },
            { rand: 1, randRange: '49-57' }, { rand: 1, randRange: '48-57' },
            { type: 'str', packet: ']\r\n250-SIZE 52428800\r\n250-8BITMIME\r\n250-PIPELINING\r\n250-PIPECONNECT\r\n250-STARTTLS\r\n250 HELP\r\n' },
          ],
          [{ type: 'str', packet: '220 TLS go ahead\r\n' }],
        ],
      },
    }],
  },
  rdp: {
    tcp: [{
      type: 'header-custom',
      settings: {
        clients: [[
          { type: 'hex', packet: '0300002c27e00000000000' },
          { type: 'str', packet: 'Cookie: mstshash=' },
          { rand: 6, randRange: '97-122' },
          { type: 'str', packet: '\r\n' },
          { type: 'hex', packet: '0100080001000000' },
        ]],
        servers: [[{ type: 'hex', packet: '030000130ed00000123400021f080001000000' }]],
      },
    }],
  },
};

function getFinalMaskForIndex(index) {
  const templates = ['pop3', 'smtp', 'rdp', 'pop3', 'smtp', 'pop3'];
  return FINALMASK_TEMPLATES[templates[index % templates.length]];
}

function buildConfig(countryCode, proxies) {
  const flags = {
    'DE': '🇩🇪', 'NL': '🇳🇱', 'FI': '🇫🇮', 'US': '🇺🇸',
    'CA': '🇨🇦', 'SE': '🇸🇪', 'TR': '🇹🇷', 'FR': '🇫🇷',
    'GB': '🇬🇧', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
  };
  const flag = flags[countryCode] || '🌐';

  const outbounds = [];
  const proxyTags = [];

  proxies.forEach((proxy, index) => {
    const tag = index === 0 ? 'proxy' : `proxy-${index + 1}`;
    proxyTags.push(tag);

    if (proxy.protocol === 'vless') {
      const outbound = {
        protocol: 'vless',
        tag,
        settings: {
          vnext: [{
            address: proxy.address,
            port: proxy.port,
            users: [{
              id: proxy.uuid || '',
              encryption: proxy.encryption || 'none',
              flow: proxy.flow || '',
            }],
          }],
        },
        streamSettings: {
          network: proxy.type || 'tcp',
          sockopt: {
            tcpKeepAliveIdle: 30,
            tcpKeepAliveInterval: 10,
            domainStrategy: 'AsIs',
          },
        },
      };

      if (proxy.security === 'tls') {
        outbound.streamSettings.security = 'tls';
        outbound.streamSettings.tlsSettings = {
          serverName: proxy.sni || proxy.address,
          fingerprint: proxy.fp || 'chrome',
          alpn: proxy.alpn ? proxy.alpn.split(',') : ['h2', 'http/1.1'],
        };
      } else if (proxy.security === 'reality') {
        outbound.streamSettings.security = 'reality';
        outbound.streamSettings.realitySettings = {
          serverName: proxy.sni || proxy.address,
          fingerprint: proxy.fp || 'chrome',
          publicKey: proxy.pbk || '',
          shortId: proxy.sid || '',
        };
      }

      if (proxy.type === 'ws') {
        outbound.streamSettings.wsSettings = {
          path: proxy.path || '/',
          headers: proxy.host ? { Host: proxy.host } : {},
        };
      } else if (proxy.type === 'tcp') {
        outbound.streamSettings.tcpSettings = { header: { type: 'none' } };
        // Add FinalMask (rotating templates)
        outbound.streamSettings.finalmask = getFinalMaskForIndex(index);
      } else if (proxy.type === 'kcp') {
        outbound.streamSettings.kcpSettings = {
          mtu: 1350, tti: 50, uplinkCapacity: 2, downlinkCapacity: 5,
          readBufferSize: 2, writeBufferSize: 2,
        };
        outbound.streamSettings.finalmask = {
          udp: [{ type: 'xicmp', settings: { dgram: true, ips: ['46.62.249.19'] } }],
        };
      }

      outbounds.push(outbound);
    } else if (proxy.protocol === 'trojan') {
      const outbound = {
        protocol: 'trojan',
        tag,
        settings: {
          servers: [{
            address: proxy.address,
            port: proxy.port,
            password: proxy.password || '',
          }],
        },
        streamSettings: {
          network: proxy.type || 'tcp',
          security: proxy.security || 'tls',
          sockopt: {
            tcpKeepAliveIdle: 30,
            tcpKeepAliveInterval: 10,
            domainStrategy: 'AsIs',
          },
        },
      };

      if (proxy.security === 'tls') {
        outbound.streamSettings.tlsSettings = {
          serverName: proxy.sni || proxy.address,
          fingerprint: proxy.fp || 'chrome',
        };
      }

      outbounds.push(outbound);
    } else if (proxy.protocol === 'shadowsocks') {
      outbounds.push({
        protocol: 'shadowsocks',
        tag,
        settings: {
          servers: [{
            address: proxy.address,
            port: proxy.port,
            method: proxy.method || 'aes-256-gcm',
            password: proxy.password || '',
          }],
        },
        streamSettings: {
          sockopt: {
            tcpKeepAliveIdle: 30,
            tcpKeepAliveInterval: 10,
            domainStrategy: 'AsIs',
          },
        },
      });
    }
  });

  outbounds.push({ tag: 'DIRECT', protocol: 'freedom', settings: {} });
  outbounds.push({ tag: 'BLOCK', protocol: 'blackhole', settings: { response: { type: 'http' } } });

  return {
    remarks: `${flag} ${countryCode}`,
    log: { loglevel: 'warning' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [
      {
        tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks',
        settings: { udp: true, auth: 'noauth' },
        sniffing: { enabled: true, destOverride: ['http', 'tls'] },
      },
      { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
    ],
    outbounds,
    routing: {
      domainStrategy: 'AsIs',
      balancers: [{
        tag: 'auto',
        selector: proxyTags,
        fallbackTag: proxyTags[0],
        strategy: {
          type: 'leastLoad',
          settings: {
            baselines: ['200ms', '500ms', '1s'],
            expected: 2,
            maxRTT: '3s',
            tolerance: 0.05,
          },
        },
      }],
      rules: [{ type: 'field', network: 'tcp,udp', balancerTag: 'auto' }],
    },
    policy: {
      levels: {
        '0': {
          timeout: { handshake: 8, connIdle: 300, uplinkOnly: 10, downlinkOnly: 30 },
        },
      },
    },
    burstObservatory: {
      subjectSelector: ['proxy'],
      pingConfig: {
        destination: 'http://cp.cloudflare.com/generate_204',
        interval: '3m',
        timeout: '5s',
        sampling: 2,
      },
    },
  };
}

app.listen(PORT, () => {
  console.log(`Config Merger server running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/sub/merge?url=<subscription_url>`);
});

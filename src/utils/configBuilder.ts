import { ParsedProxy } from './proxyParser';

interface XrayConfig {
  remarks: string;
  log: { loglevel: string };
  dns: { servers: string[] };
  inbounds: any[];
  outbounds: any[];
  routing: any;
  policy: any;
  burstObservatory?: any;
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

function getFinalMask(index: number): any {
  const templates = ['pop3', 'smtp', 'rdp', 'pop3', 'smtp'];
  return FINALMASK_TEMPLATES[templates[index % templates.length] as keyof typeof FINALMASK_TEMPLATES];
}

const FLAGS: Record<string, string> = {
  'DE': '🇩🇪', 'NL': '🇳🇱', 'FI': '🇫🇮', 'US': '🇺🇸',
  'CA': '🇨🇦', 'SE': '🇸🇪', 'TR': '🇹🇷', 'FR': '🇫🇷',
  'GB': '🇬🇧', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
  'AU': '🇦🇺', 'BR': '🇧🇷', 'IN': '🇮🇳', 'RU': '🇷🇺',
};

export function getFlag(code: string): string {
  return FLAGS[code] || '🌐';
}

function buildOutbound(proxy: ParsedProxy, tag: string, index: number): any {
  if (proxy.protocol === 'vless') {
    const out: any = {
      protocol: 'vless',
      tag,
      settings: {
        vnext: [{
          address: proxy.address,
          port: proxy.port,
          users: [{ id: proxy.uuid || '', encryption: proxy.encryption || 'none', flow: proxy.flow || '' }],
        }],
      },
      streamSettings: {
        network: proxy.type || 'tcp',
        sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' },
      },
    };

    if (proxy.security === 'tls') {
      out.streamSettings.security = 'tls';
      out.streamSettings.tlsSettings = {
        serverName: proxy.sni || proxy.address,
        fingerprint: proxy.fp || 'chrome',
        alpn: proxy.alpn ? proxy.alpn.split(',') : ['h2', 'http/1.1'],
      };
    } else if (proxy.security === 'reality') {
      out.streamSettings.security = 'reality';
      out.streamSettings.realitySettings = {
        serverName: proxy.sni || proxy.address,
        fingerprint: proxy.fp || 'chrome',
        publicKey: proxy.pbk || '',
        shortId: proxy.sid || '',
        alpn: proxy.alpn ? proxy.alpn.split(',') : ['h2', 'http/1.1'],
      };
    }

    const network = proxy.type || 'tcp';
    if (network === 'ws') {
      out.streamSettings.wsSettings = { path: proxy.path || '/', headers: proxy.host ? { Host: proxy.host } : {} };
    } else if (network === 'tcp') {
      out.streamSettings.tcpSettings = { header: { type: 'none' } };
      out.streamSettings.finalmask = getFinalMask(index);
    }

    return out;
  }

  if (proxy.protocol === 'trojan') {
    const out: any = {
      protocol: 'trojan',
      tag,
      settings: { servers: [{ address: proxy.address, port: proxy.port, password: proxy.password || '' }] },
      streamSettings: {
        network: proxy.type || 'tcp',
        security: proxy.security || 'tls',
        sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' },
      },
    };
    if (proxy.security === 'tls') {
      out.streamSettings.tlsSettings = {
        serverName: proxy.sni || proxy.address,
        fingerprint: proxy.fp || 'chrome',
      };
    }
    if ((proxy.type || 'tcp') === 'tcp') {
      out.streamSettings.tcpSettings = { header: { type: 'none' } };
      out.streamSettings.finalmask = getFinalMask(index);
    }
    return out;
  }

  if (proxy.protocol === 'shadowsocks') {
    return {
      protocol: 'shadowsocks',
      tag,
      settings: { servers: [{ address: proxy.address, port: proxy.port, method: proxy.method || 'aes-256-gcm', password: proxy.password || '' }] },
      streamSettings: { sockopt: { tcpKeepAliveIdle: 30, tcpKeepAliveInterval: 10, domainStrategy: 'AsIs' } },
    };
  }

  return null;
}

// Build merged config with balancer (for groups with multiple proxies)
export function buildMergedConfig(country: string, tag: string, proxies: ParsedProxy[]): XrayConfig {
  const flag = getFlag(country);
  const outbounds: any[] = [];
  const proxyTags: string[] = [];

  proxies.forEach((proxy, index) => {
    const tag_name = index === 0 ? 'proxy' : `proxy-${index + 1}`;
    const outbound = buildOutbound(proxy, tag_name, index);
    if (outbound) {
      outbounds.push(outbound);
      proxyTags.push(tag_name);
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

// Build single proxy config (for VIP)
export function buildSingleConfig(proxy: ParsedProxy): XrayConfig {
  const outbound = buildOutbound(proxy, 'proxy', 0);
  const outbounds = [
    outbound,
    { tag: 'DIRECT', protocol: 'freedom', settings: {} },
    { tag: 'BLOCK', protocol: 'blackhole', settings: { response: { type: 'http' } } },
  ];

  return {
    remarks: proxy.name,
    log: { loglevel: 'warning' },
    dns: { servers: ['1.1.1.1', '8.8.8.8'] },
    inbounds: [
      { tag: 'socks', port: 10808, listen: '127.0.0.1', protocol: 'socks', settings: { udp: true, auth: 'noauth' }, sniffing: { enabled: true, destOverride: ['http', 'tls'] } },
      { tag: 'http', port: 10809, listen: '127.0.0.1', protocol: 'http' },
    ],
    outbounds,
    routing: {
      domainStrategy: 'AsIs',
      rules: [{ type: 'field', network: 'tcp,udp', outboundTag: 'proxy' }],
    },
    policy: { levels: { '0': { timeout: { handshake: 8, connIdle: 300, uplinkOnly: 10, downlinkOnly: 30 } } } },
  };
}

export function configToJson(config: XrayConfig): string {
  return JSON.stringify(config, null, 2);
}

export function configToBase64(config: XrayConfig): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
}

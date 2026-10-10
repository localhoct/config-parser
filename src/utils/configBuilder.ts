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

// FinalMask templates for different protocols
const FINALMASK_TEMPLATES = {
  // POP3/Dovecot style
  pop3: {
    tcp: [
      {
        type: 'header-custom',
        settings: {
          clients: [
            [],
            [{ type: 'str', packet: 'CAPA\r\n' }],
            [{ type: 'str', packet: 'STLS\r\n' }],
          ],
          servers: [
            [{ type: 'str', packet: '+OK Dovecot (Ubuntu) ready.\r\n' }],
            [{ type: 'str', packet: '+OK\r\nCAPA\r\nTOP\r\nUIDL\r\nRESP-CODES\r\nPIPELINING\r\nAUTH-RESP-CODE\r\nSTLS\r\nUSER\r\nSASL PLAIN LOGIN\r\n.\r\n' }],
            [{ type: 'str', packet: '+OK Begin TLS negotiation now.\r\n' }],
          ],
        },
      },
    ],
  },
  // SMTP/Exim style
  smtp: {
    tcp: [
      {
        type: 'header-custom',
        settings: {
          clients: [
            [],
            [
              { type: 'str', packet: 'EHLO ' },
              { type: 'str', packet: 'mailhost' },
              { type: 'str', packet: '.example.org\r\n' },
            ],
            [{ type: 'str', packet: 'STARTTLS\r\n' }],
          ],
          servers: [
            [
              { type: 'str', packet: '220 mail.example.net ESMTP Exim 4.96 Mon, 05 Oct 2026 ' },
              { rand: 1, randRange: '48-49' },
              { rand: 1, randRange: '48-57' },
              { type: 'str', packet: ':' },
              { rand: 1, randRange: '48-53' },
              { rand: 1, randRange: '48-57' },
              { type: 'str', packet: ':' },
              { rand: 1, randRange: '48-53' },
              { rand: 1, randRange: '48-57' },
              { type: 'str', packet: ' +0000\r\n' },
            ],
            [
              { type: 'str', packet: '250-mail.example.net Hello ' },
              { type: 'str', packet: 'mailhost' },
              { type: 'str', packet: '.example.org [198.51.100.' },
              { rand: 1, randRange: '49-57' },
              { rand: 1, randRange: '48-57' },
              { type: 'str', packet: ']\r\n250-SIZE 52428800\r\n250-8BITMIME\r\n250-PIPELINING\r\n250-PIPECONNECT\r\n250-STARTTLS\r\n250 HELP\r\n' },
            ],
            [{ type: 'str', packet: '220 TLS go ahead\r\n' }],
          ],
        },
      },
    ],
  },
  // RDP style
  rdp: {
    tcp: [
      {
        type: 'header-custom',
        settings: {
          clients: [
            [
              { type: 'hex', packet: '0300002c27e00000000000' },
              { type: 'str', packet: 'Cookie: mstshash=' },
              { rand: 6, randRange: '97-122' },
              { type: 'str', packet: '\r\n' },
              { type: 'hex', packet: '0100080001000000' },
            ],
          ],
          servers: [
            [{ type: 'hex', packet: '030000130ed00000123400021f080001000000' }],
          ],
        },
      },
    ],
  },
  // ICMP (for KCP/UDP)
  icmp: {
    udp: [
      {
        type: 'xicmp',
        settings: {
          dgram: true,
          ips: ['46.62.249.19'],
        },
      },
    ],
  },
};

function getFinalMaskForIndex(index: number): any {
  // Rotate through different FinalMask templates
  const templates = ['pop3', 'smtp', 'rdp', 'pop3', 'smtp', 'icmp'];
  const templateKey = templates[index % templates.length];
  return FINALMASK_TEMPLATES[templateKey as keyof typeof FINALMASK_TEMPLATES];
}

function buildVlessOutbound(proxy: ParsedProxy, tag: string, index: number): any {
  const outbound: any = {
    protocol: 'vless',
    tag,
    settings: {
      vnext: [
        {
          address: proxy.address,
          port: proxy.port,
          users: [
            {
              id: proxy.uuid || '',
              encryption: proxy.encryption || 'none',
              flow: proxy.flow || '',
            },
          ],
        },
      ],
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

  // Security settings
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
      alpn: proxy.alpn ? proxy.alpn.split(',') : ['h2', 'http/1.1'],
    };
  }

  // Transport settings
  const network = proxy.type || 'tcp';
  if (network === 'ws') {
    outbound.streamSettings.wsSettings = {
      path: proxy.path || '/',
      headers: proxy.host ? { Host: proxy.host } : {},
    };
  } else if (network === 'grpc') {
    outbound.streamSettings.grpcSettings = {
      serviceName: proxy.path || '',
    };
  } else if (network === 'tcp') {
    outbound.streamSettings.tcpSettings = {
      header: { type: 'none' },
    };
    // Add FinalMask for TCP connections
    outbound.streamSettings.finalmask = getFinalMaskForIndex(index);
  } else if (network === 'kcp') {
    outbound.streamSettings.kcpSettings = {
      mtu: 1350,
      tti: 50,
      uplinkCapacity: 2,
      downlinkCapacity: 5,
      readBufferSize: 2,
      writeBufferSize: 2,
    };
    // Add FinalMask for KCP (ICMP)
    outbound.streamSettings.finalmask = FINALMASK_TEMPLATES.icmp;
  }

  return outbound;
}

function buildTrojanOutbound(proxy: ParsedProxy, tag: string, _index: number): any {
  const outbound: any = {
    protocol: 'trojan',
    tag,
    settings: {
      servers: [
        {
          address: proxy.address,
          port: proxy.port,
          password: proxy.password || '',
        },
      ],
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

  const network = proxy.type || 'tcp';
  if (network === 'ws') {
    outbound.streamSettings.wsSettings = {
      path: proxy.path || '/',
      headers: proxy.host ? { Host: proxy.host } : {},
    };
  } else if (network === 'grpc') {
    outbound.streamSettings.grpcSettings = {
      serviceName: proxy.path || '',
    };
  } else if (network === 'tcp') {
    outbound.streamSettings.tcpSettings = {
      header: { type: 'none' },
    };
  }

  return outbound;
}

function buildSSOutbound(proxy: ParsedProxy, tag: string): any {
  return {
    protocol: 'shadowsocks',
    tag,
    settings: {
      servers: [
        {
          address: proxy.address,
          port: proxy.port,
          method: proxy.method || 'aes-256-gcm',
          password: proxy.password || '',
        },
      ],
    },
    streamSettings: {
      sockopt: {
        tcpKeepAliveIdle: 30,
        tcpKeepAliveInterval: 10,
        domainStrategy: 'AsIs',
      },
    },
  };
}

function buildOutbound(proxy: ParsedProxy, tag: string, index: number): any {
  switch (proxy.protocol) {
    case 'vless':
      return buildVlessOutbound(proxy, tag, index);
    case 'trojan':
      return buildTrojanOutbound(proxy, tag, index);
    case 'shadowsocks':
      return buildSSOutbound(proxy, tag);
    default:
      return buildVlessOutbound(proxy, tag, index);
  }
}

const COUNTRY_FLAGS: Record<string, string> = {
  'DE': '🇩🇪',
  'NL': '🇳🇱',
  'FI': '🇫🇮',
  'US': '🇺🇸',
  'CA': '🇨🇦',
  'SE': '🇸🇪',
  'TR': '🇹🇷',
  'FR': '🇫🇷',
  'GB': '🇬🇧',
  'JP': '🇯🇵',
  'KR': '🇰🇷',
  'SG': '🇸🇬',
  'AU': '🇦🇺',
  'BR': '🇧🇷',
  'IN': '🇮🇳',
  'RU': '🇷🇺',
  'IT': '🇮🇹',
  'ES': '🇪🇸',
  'AT': '🇦🇹',
  'CH': '🇨🇭',
  'IR': '🇮🇷',
};

export function buildMergedConfig(countryCode: string, proxies: ParsedProxy[]): XrayConfig {
  const flag = COUNTRY_FLAGS[countryCode] || '🌐';
  
  const outbounds: any[] = [];
  const proxyTags: string[] = [];

  proxies.forEach((proxy, index) => {
    const tag = index === 0 ? 'proxy' : `proxy-${index + 1}`;
    const outbound = buildOutbound(proxy, tag, index);
    outbounds.push(outbound);
    proxyTags.push(tag);
  });

  // Add DIRECT and BLOCK
  outbounds.push({
    tag: 'DIRECT',
    protocol: 'freedom',
    settings: {},
  });
  outbounds.push({
    tag: 'BLOCK',
    protocol: 'blackhole',
    settings: {
      response: { type: 'http' },
    },
  });

  const config: XrayConfig = {
    remarks: `${flag} ${countryCode}`,
    log: {
      loglevel: 'warning',
    },
    dns: {
      servers: ['1.1.1.1', '8.8.8.8'],
    },
    inbounds: [
      {
        tag: 'socks',
        port: 10808,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: {
          udp: true,
          auth: 'noauth',
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls'],
        },
      },
      {
        tag: 'http',
        port: 10809,
        listen: '127.0.0.1',
        protocol: 'http',
      },
    ],
    outbounds,
    routing: {
      domainStrategy: 'AsIs',
      balancers: [
        {
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
        },
      ],
      rules: [
        {
          type: 'field',
          network: 'tcp,udp',
          balancerTag: 'auto',
        },
      ],
    },
    policy: {
      levels: {
        '0': {
          timeout: {
            handshake: 8,
            connIdle: 300,
            uplinkOnly: 10,
            downlinkOnly: 30,
          },
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

  return config;
}

export function buildAllConfigs(groups: Map<string, ParsedProxy[]>): Map<string, XrayConfig> {
  const configs = new Map<string, XrayConfig>();
  
  for (const [countryCode, proxies] of groups) {
    if (proxies.length > 0) {
      configs.set(countryCode, buildMergedConfig(countryCode, proxies));
    }
  }
  
  return configs;
}

export function configToJson(config: XrayConfig): string {
  return JSON.stringify(config, null, 2);
}

export function configToBase64(config: XrayConfig): string {
  return btoa(JSON.stringify(config));
}

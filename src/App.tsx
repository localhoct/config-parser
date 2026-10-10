import { useState, useCallback } from 'react';
import { fetchSubscription, decodeSubscription, parseSubscription, SubscriptionData } from './utils/subscription';
import { buildAllConfigs, buildMergedConfig, configToJson, configToBase64 } from './utils/configBuilder';
// configToJson used in template section
import { ParsedProxy } from './utils/proxyParser';

function App() {
  const [subUrl, setSubUrl] = useState('');
  const [rawLinks, setRawLinks] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'raw'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'json' | 'base64'>('json');
  const [copied, setCopied] = useState('');
  const [activeTab, setActiveTab] = useState<'groups' | 'all'>('groups');

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError('');
    setData(null);
    setSelectedGroup(null);

    try {
      let links: string[];

      if (inputMode === 'url') {
        if (!subUrl.trim()) {
          throw new Error('لطفاً آدرس ساب‌لینک را وارد کنید');
        }
        const raw = await fetchSubscription(subUrl.trim());
        links = decodeSubscription(raw);
      } else {
        if (!rawLinks.trim()) {
          throw new Error('لطفاً لینک‌ها را وارد کنید');
        }
        links = decodeSubscription(rawLinks.trim());
      }

      if (links.length === 0) {
        throw new Error('هیچ لینک پروکسی معتبری یافت نشد');
      }

      const parsed = parseSubscription(links);
      setData(parsed);
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  }, [subUrl, rawLinks, inputMode]);

  const getSelectedConfig = () => {
    if (!data || !selectedGroup) return null;
    const proxies = data.groups.get(selectedGroup);
    if (!proxies) return null;
    return buildMergedConfig(selectedGroup, proxies);
  };

  const getOutput = () => {
    const config = getSelectedConfig();
    if (!config) return '';
    if (outputFormat === 'json') {
      return configToJson(config);
    }
    return configToBase64(config);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAllConfigsJson = () => {
    if (!data) return '';
    const configs = buildAllConfigs(data.groups);
    const results: string[] = [];
    for (const [code, config] of configs) {
      results.push(`// ===== ${code} =====\n${configToJson(config)}`);
    }
    return results.join('\n\n');
  };

  const getAllConfigsSubscription = () => {
    if (!data) return '';
    const configs = buildAllConfigs(data.groups);
    const links: string[] = [];
    for (const [, config] of configs) {
      links.push(configToBase64(config));
    }
    // Return as base64 encoded list of base64 configs (for subscription clients)
    return btoa(links.join('\n'));
  };

  const getCountryFlag = (code: string): string => {
    const flags: Record<string, string> = {
      'DE': '🇩🇪', 'NL': '🇳🇱', 'FI': '🇫🇮', 'US': '🇺🇸',
      'CA': '🇨🇦', 'SE': '🇸🇪', 'TR': '🇹🇷', 'FR': '🇫🇷',
      'GB': '🇬🇧', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
      'AU': '🇦🇺', 'BR': '🇧🇷', 'IN': '🇮🇳', 'RU': '🇷🇺',
      'IT': '🇮🇹', 'ES': '🇪🇸', 'AT': '🇦🇹', 'CH': '🇨🇭',
    };
    return flags[code] || '🌐';
  };

  const getProtocolColor = (protocol: string): string => {
    switch (protocol) {
      case 'vless': return 'text-blue-400';
      case 'vmess': return 'text-green-400';
      case 'trojan': return 'text-yellow-400';
      case 'shadowsocks': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" dir="rtl">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <i className="fas fa-project-diagram text-white text-lg"></i>
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Config Merger
              </h1>
              <p className="text-[10px] text-slate-500">Xray Balancer • FinalMask • leastLoad</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Ready
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Input Section */}
        <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5 backdrop-blur-sm">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <i className="fas fa-link text-blue-400"></i>
            <span>ورودی</span>
          </h2>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('url')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'url'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <i className="fas fa-globe ml-1.5"></i>
              ساب‌لینک
            </button>
            <button
              onClick={() => setInputMode('raw')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                inputMode === 'raw'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <i className="fas fa-paste ml-1.5"></i>
              لینک خام
            </button>
          </div>

          {inputMode === 'url' ? (
            <input
              type="url"
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              placeholder="https://forsubs.example.com/sub/..."
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-600/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm"
              dir="ltr"
            />
          ) : (
            <textarea
              value={rawLinks}
              onChange={(e) => setRawLinks(e.target.value)}
              placeholder={"vless://uuid@address:port?...\nvmess://...\ntrojan://...\nss://..."}
              rows={5}
              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-600/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 font-mono text-xs"
              dir="ltr"
            />
          )}

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium text-sm hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>در حال پردازش...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-bolt"></i>
                  <span>پردازش و ترکیب</span>
                </>
              )}
            </button>
            {data && (
              <span className="text-xs text-slate-400">
                {data.proxies.length} پروکسی در {data.groups.size} کشور
              </span>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* Results */}
        {data && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-xl font-bold text-blue-400">{data.proxies.length}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">پروکسی</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-xl font-bold text-purple-400">{data.groups.size}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">کشور</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-xl font-bold text-green-400">
                  {data.proxies.filter(p => p.protocol === 'vless').length}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">VLESS</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-xl font-bold text-amber-400">
                  {data.proxies.filter(p => p.protocol !== 'vless').length}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">سایر</div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1 border border-slate-700/40">
              <button
                onClick={() => setActiveTab('groups')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'groups'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className="fas fa-layer-group ml-1.5"></i>
                گروه‌ها
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <i className="fas fa-boxes-stacked ml-1.5"></i>
                خروجی کامل
              </button>
            </div>

            {activeTab === 'groups' && (
              <>
                {/* Groups Grid */}
                <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5 backdrop-blur-sm">
                  <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <i className="fas fa-earth-americas text-green-400"></i>
                    <span>کشورها را انتخاب کنید</span>
                  </h2>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {Array.from(data.groups.entries())
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([code, proxies]) => (
                      <button
                        key={code}
                        onClick={() => setSelectedGroup(code === selectedGroup ? null : code)}
                        className={`p-2.5 rounded-xl border transition-all text-center group ${
                          selectedGroup === code
                            ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10 scale-105'
                            : 'bg-slate-900/30 border-slate-700/40 hover:bg-slate-700/30 hover:border-slate-600/50'
                        }`}
                      >
                        <div className="text-xl">{getCountryFlag(code)}</div>
                        <div className="text-xs font-bold mt-0.5">{code}</div>
                        <div className="text-[10px] text-slate-500">{proxies.length}x</div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Selected Group Details */}
                {selectedGroup && (
                  <>
                    {/* Proxy List */}
                    <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5 backdrop-blur-sm">
                      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                        <span className="text-xl">{getCountryFlag(selectedGroup)}</span>
                        <span>{selectedGroup}</span>
                        <span className="text-xs text-slate-500 font-normal">
                          ({data.groups.get(selectedGroup)?.length} پروکسی)
                        </span>
                      </h2>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                        {data.groups.get(selectedGroup)?.map((proxy: ParsedProxy, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-700/30 text-xs flex items-center justify-between"
                            dir="ltr"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${getProtocolColor(proxy.protocol)}`}>
                                {proxy.protocol === 'shadowsocks' ? 'SS' : proxy.protocol.toUpperCase()}
                              </span>
                              <span className="text-slate-400 truncate max-w-[200px]">
                                {proxy.name}
                              </span>
                            </div>
                            <div className="text-slate-500 font-mono">
                              {proxy.address}:{proxy.port}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Config Output */}
                    <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                          <i className="fas fa-file-code text-purple-400"></i>
                          <span>کانفیگ {getCountryFlag(selectedGroup)} {selectedGroup}</span>
                        </h2>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setOutputFormat('json')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              outputFormat === 'json'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-700/50 text-slate-400 hover:text-white'
                            }`}
                          >
                            JSON
                          </button>
                          <button
                            onClick={() => setOutputFormat('base64')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              outputFormat === 'base64'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-700/50 text-slate-400 hover:text-white'
                            }`}
                          >
                            Base64
                          </button>
                        </div>
                      </div>

                      <pre
                        className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/40 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-80 overflow-y-auto text-left leading-relaxed"
                        dir="ltr"
                      >
                        {getOutput()}
                      </pre>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleCopy(getOutput(), 'config')}
                          className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40 text-white text-xs hover:bg-slate-700 transition-all flex items-center gap-1.5"
                        >
                          <i className={`fas ${copied === 'config' ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                          {copied === 'config' ? 'کپی شد!' : 'کپی'}
                        </button>
                        <button
                          onClick={() => handleDownload(getOutput(), `${selectedGroup}-xray-config.json`)}
                          className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40 text-white text-xs hover:bg-slate-700 transition-all flex items-center gap-1.5"
                        >
                          <i className="fas fa-download"></i>
                          دانلود
                        </button>
                      </div>
                    </section>
                  </>
                )}
              </>
            )}

            {activeTab === 'all' && (
              <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5 backdrop-blur-sm">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <i className="fas fa-boxes-stacked text-amber-400"></i>
                  <span>تمام کانفیگ‌ها</span>
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  هر کشور یک کانفیگ جداگانه با balancer leastLoad دارد. 
                  می‌توانید هر کانفیگ را جداگانه یا همه را یکجا دریافت کنید.
                </p>

                {/* Individual configs */}
                <div className="space-y-3 mb-6">
                  {Array.from(data.groups.entries())
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([code, proxies]) => {
                      const config = buildMergedConfig(code, proxies);
                      const json = configToJson(config);
                      const b64 = configToBase64(config);
                      return (
                        <div key={code} className="p-3 rounded-xl bg-slate-900/30 border border-slate-700/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getCountryFlag(code)}</span>
                              <span className="text-sm font-bold">{code}</span>
                              <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                                {proxies.length} outbound
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleCopy(json, `json-${code}`)}
                                className="px-2 py-1 rounded-md bg-slate-700/50 text-[10px] hover:bg-slate-700 transition-all flex items-center gap-1"
                              >
                                <i className={`fas ${copied === `json-${code}` ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                                JSON
                              </button>
                              <button
                                onClick={() => handleCopy(b64, `b64-${code}`)}
                                className="px-2 py-1 rounded-md bg-slate-700/50 text-[10px] hover:bg-slate-700 transition-all flex items-center gap-1"
                              >
                                <i className={`fas ${copied === `b64-${code}` ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                                Base64
                              </button>
                              <button
                                onClick={() => handleDownload(json, `${code}-config.json`)}
                                className="px-2 py-1 rounded-md bg-slate-700/50 text-[10px] hover:bg-slate-700 transition-all flex items-center gap-1"
                              >
                                <i className="fas fa-download"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Bulk actions */}
                <div className="border-t border-slate-700/40 pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-slate-300">خروجی یکجا</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCopy(getAllConfigsJson(), 'all-json')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-1.5"
                    >
                      <i className={`fas ${copied === 'all-json' ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied === 'all-json' ? 'کپی شد!' : 'کپی همه (JSON)'}
                    </button>
                    <button
                      onClick={() => handleCopy(getAllConfigsSubscription(), 'all-sub')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-medium hover:from-green-500 hover:to-emerald-500 transition-all shadow-lg shadow-green-600/20 flex items-center gap-1.5"
                    >
                      <i className={`fas ${copied === 'all-sub' ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied === 'all-sub' ? 'کپی شد!' : 'کپی Subscription'}
                    </button>
                    <button
                      onClick={() => handleDownload(getAllConfigsJson(), 'all-configs.json')}
                      className="px-4 py-2 rounded-xl bg-slate-700/50 border border-slate-600/40 text-white text-xs font-medium hover:bg-slate-700 transition-all flex items-center gap-1.5"
                    >
                      <i className="fas fa-download"></i>
                      دانلود فایل
                    </button>
                  </div>
                </div>

                {/* Subscription URL Generator */}
                <div className="border-t border-slate-700/40 pt-4 mt-4 space-y-3">
                  <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <i className="fas fa-link text-cyan-400"></i>
                    لینک‌های ساب نهایی (برای کلاینت)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    بعد از دیپلوی سرور، این لینک‌ها را در کلاینت (v2rayN, FlClash, v2rayNG) وارد کنید.
                    هر کشور یک ساب‌لینک جداگانه با balancer خواهد داشت.
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {Array.from(data.groups.entries())
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([code]) => {
                        const config = buildMergedConfig(code, data.groups.get(code)!);
                        const b64 = configToBase64(config);
                        return (
                          <div key={code} className="p-2.5 rounded-lg bg-slate-900/30 border border-slate-700/20">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{getCountryFlag(code)}</span>
                                <span className="text-xs font-bold">{code}</span>
                                <span className="text-[10px] text-slate-500">
                                  ({data.groups.get(code)?.length} outbound)
                                </span>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCopy(b64, `b64-${code}`)}
                                  className="px-2 py-0.5 rounded bg-slate-700/50 text-[10px] hover:bg-slate-700 transition-all"
                                  title="Copy Base64"
                                >
                                  <i className={`fas ${copied === `b64-${code}` ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                                  <span className="mr-1">Base64</span>
                                </button>
                                <button
                                  onClick={() => handleCopy(configToJson(config), `json-${code}-all`)}
                                  className="px-2 py-0.5 rounded bg-slate-700/50 text-[10px] hover:bg-slate-700 transition-all"
                                  title="Copy JSON"
                                >
                                  <i className={`fas ${copied === `json-${code}-all` ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                                  <span className="mr-1">JSON</span>
                                </button>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono truncate" dir="ltr">
                              <span className="text-slate-600">Server URL: </span>
                              <span className="text-cyan-500/70">
                                https://your-domain.com/sub/config/{code}?url=...
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  {/* Import to client buttons */}
                  <div className="mt-3 p-3 rounded-lg bg-slate-900/20 border border-slate-700/20">
                    <p className="text-[10px] text-slate-500 mb-2">
                      <i className="fas fa-info-circle ml-1"></i>
                      برای استفاده: کانفیگ JSON را کپی کرده و در کلاینت به صورت "Import from clipboard" وارد کنید.
                      یا سرور را دیپلوی کنید و از لینک ساب مستقیم استفاده کنید.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400">
                        v2rayN: فایل → وارد کردن → از کلیپ‌بورد
                      </span>
                      <span className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-[10px] text-green-400">
                        FlClash: پروفایل → افزودن → Local
                      </span>
                      <span className="px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400">
                        v2rayNG: افزودن از کلیپ‌بورد
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Info Section */}
        {!data && (
          <section className="bg-slate-800/30 rounded-2xl border border-slate-700/30 p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <i className="fas fa-link text-blue-400 text-sm"></i>
                  </div>
                  <h3 className="text-sm font-semibold">۱. ورودی</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ساب‌لینک یا لینک‌های خام پروکسی را وارد کنید.
                  فرمت‌های VLESS, VMess, Trojan, Shadowsocks پشتیبانی می‌شوند.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <i className="fas fa-shuffle text-purple-400 text-sm"></i>
                  </div>
                  <h3 className="text-sm font-semibold">۲. ترکیب</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  پروکسی‌ها بر اساس کشور (DE, NL, FI, ...) گروه‌بندی شده
                  و هر گروه با balancer leastLoad ترکیب می‌شود.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <i className="fas fa-file-export text-green-400 text-sm"></i>
                  </div>
                  <h3 className="text-sm font-semibold">۳. خروجی</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  کانفیگ JSON یا Base64 دریافت کنید.
                  شامل FinalMask, BurstObservatory و routing هوشمند.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/40 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-slate-600">
            Config Merger • Xray Core • FinalMask • leastLoad Balancer • BurstObservatory
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

import { useState, useCallback } from 'react';
import { fetchSubscription, decodeSubscription, parseSubscription, SubscriptionData, ConfigGroup } from './utils/subscription';
import { buildMergedConfig, buildSingleConfig, configToJson, configToBase64, getFlag } from './utils/configBuilder';

function App() {
  const [subUrl, setSubUrl] = useState('https://forsubs.software4you.ir/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4');
  const [rawLinks, setRawLinks] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'raw'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<'json' | 'base64'>('json');
  const [copied, setCopied] = useState('');
  const [tab, setTab] = useState<'merged' | 'vip'>('merged');

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError('');
    setData(null);
    setSelectedKey(null);

    try {
      let links: string[];
      if (inputMode === 'url') {
        if (!subUrl.trim()) throw new Error('لطفاً آدرس ساب‌لینک را وارد کنید');
        const raw = await fetchSubscription(subUrl.trim());
        links = decodeSubscription(raw);
      } else {
        if (!rawLinks.trim()) throw new Error('لطفاً لینک‌ها را وارد کنید');
        links = decodeSubscription(rawLinks.trim());
      }

      if (links.length === 0) throw new Error('هیچ لینک پروکسی معتبری یافت نشد');
      setData(parseSubscription(links));
    } catch (err: any) {
      setError(err.message || 'خطا');
    } finally {
      setLoading(false);
    }
  }, [subUrl, rawLinks, inputMode]);

  const getSelectedConfig = () => {
    if (!data || !selectedKey) return null;
    const group = data.groups.get(selectedKey);
    if (!group) return null;
    
    if (group.isVIP) {
      // VIP: single proxy
      return buildSingleConfig(group.proxies[0]);
    } else {
      // Merged: all proxies in group
      return buildMergedConfig(group.country, group.tag, group.proxies);
    }
  };

  const getOutput = () => {
    const config = getSelectedConfig();
    if (!config) return '';
    return outputFormat === 'json' ? configToJson(config) : configToBase64(config);
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Separate merged groups from VIP groups
  const mergedGroups = data ? Array.from(data.groups.values()).filter(g => !g.isVIP).sort((a, b) => b.proxies.length - a.proxies.length) : [];
  const vipGroups = data ? Array.from(data.groups.values()).filter(g => g.isVIP) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" dir="rtl">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <i className="fas fa-shuffle text-white"></i>
          </div>
          <div>
            <h1 className="text-base font-bold">Config Merger</h1>
            <p className="text-[10px] text-slate-500">ترکیب هوشمند کانفیگ‌ها بر اساس کشور و تگ</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Input */}
        <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setInputMode('url')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'url' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              <i className="fas fa-link ml-1"></i> ساب‌لینک
            </button>
            <button
              onClick={() => setInputMode('raw')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'raw' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400'
              }`}
            >
              <i className="fas fa-paste ml-1"></i> لینک خام
            </button>
          </div>

          {inputMode === 'url' ? (
            <input
              type="url"
              value={subUrl}
              onChange={(e) => setSubUrl(e.target.value)}
              placeholder="https://forsubs.software4you.ir/sub/..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-600/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
              dir="ltr"
            />
          ) : (
            <textarea
              value={rawLinks}
              onChange={(e) => setRawLinks(e.target.value)}
              placeholder={"vless://...\ntrojan://...\nss://..."}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-600/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-xs"
              dir="ltr"
            />
          )}

          <button
            onClick={handleFetch}
            disabled={loading}
            className="mt-3 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium disabled:opacity-50 shadow-lg shadow-blue-600/20 flex items-center gap-2"
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin"></i> در حال دریافت...</>
            ) : (
              <><i className="fas fa-bolt"></i> دریافت و پردازش</>
            )}
          </button>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <i className="fas fa-exclamation-circle ml-1"></i> {error}
            </div>
          )}
        </section>

        {/* Results */}
        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-lg font-bold text-blue-400">{data.proxies.length}</div>
                <div className="text-[10px] text-slate-500">کل پروکسی</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-lg font-bold text-green-400">{mergedGroups.length}</div>
                <div className="text-[10px] text-slate-500">گروه ترکیبی</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-lg font-bold text-amber-400">{vipGroups.length}</div>
                <div className="text-[10px] text-slate-500">کانفیگ VIP</div>
              </div>
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-3 text-center">
                <div className="text-lg font-bold text-purple-400">{new Set(data.proxies.map(p => p.countryCode)).size}</div>
                <div className="text-[10px] text-slate-500">کشور</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1 border border-slate-700/40">
              <button
                onClick={() => { setTab('merged'); setSelectedKey(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  tab === 'merged' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                <i className="fas fa-layer-group ml-1"></i>
                ترکیبی ({mergedGroups.length})
              </button>
              <button
                onClick={() => { setTab('vip'); setSelectedKey(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                  tab === 'vip' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                <i className="fas fa-crown ml-1"></i>
                VIP ({vipGroups.length})
              </button>
            </div>

            {/* Merged Groups */}
            {tab === 'merged' && (
              <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <i className="fas fa-object-group text-green-400"></i>
                  گروه‌های ترکیبی (با Balancer)
                </h2>
                <p className="text-[11px] text-slate-500 mb-3">
                  هر گروه شامل تمام پروکسی‌های یک کشور + یک تگ است که با balancer leastLoad ترکیب شده‌اند.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {mergedGroups.map((group: ConfigGroup) => (
                    <button
                      key={group.key}
                      onClick={() => setSelectedKey(group.key === selectedKey ? null : group.key)}
                      className={`p-3 rounded-xl border transition-all text-center ${
                        selectedKey === group.key
                          ? 'bg-blue-600/20 border-blue-500/50 scale-105'
                          : 'bg-slate-900/30 border-slate-700/40 hover:bg-slate-700/30'
                      }`}
                    >
                      <div className="text-xl">{getFlag(group.country)}</div>
                      <div className="text-xs font-bold mt-1">{group.country}</div>
                      <div className="text-[10px] text-slate-400 bg-slate-800/50 rounded px-1.5 py-0.5 mt-1 inline-block">
                        [{group.tag}]
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{group.proxies.length} پروکسی</div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* VIP Groups */}
            {tab === 'vip' && (
              <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <i className="fas fa-crown text-amber-400"></i>
                  کانفیگ‌های VIP (بدون ترکیب)
                </h2>
                <p className="text-[11px] text-slate-500 mb-3">
                  هر کانفیگ VIP به صورت جداگانه (Custom Config) ارائه می‌شود.
                </p>
                <div className="space-y-1.5 max-h-96 overflow-y-auto">
                  {vipGroups.map((group: ConfigGroup) => {
                    const proxy = group.proxies[0];
                    return (
                      <button
                        key={group.key}
                        onClick={() => setSelectedKey(group.key === selectedKey ? null : group.key)}
                        className={`w-full p-3 rounded-lg border transition-all text-right flex items-center justify-between ${
                          selectedKey === group.key
                            ? 'bg-amber-600/10 border-amber-500/40'
                            : 'bg-slate-900/30 border-slate-700/40 hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFlag(group.country)}</span>
                          <div>
                            <div className="text-xs font-medium truncate max-w-[200px]">{proxy.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                              {proxy.address}:{proxy.port}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          VIP
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Selected Config Output */}
            {selectedKey && (
              <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <i className="fas fa-file-code text-purple-400"></i>
                    <span>
                      {data.groups.get(selectedKey)?.isVIP ? 'کانفیگ VIP' : `کانفیگ ترکیبی`}
                      {' '}
                      {getFlag(data.groups.get(selectedKey)!.country)}
                      {' '}
                      {data.groups.get(selectedKey)!.country}
                      {!data.groups.get(selectedKey)!.isVIP && (
                        <span className="text-slate-400">[{data.groups.get(selectedKey)!.tag}]</span>
                      )}
                    </span>
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setOutputFormat('json')}
                      className={`px-2 py-1 rounded text-[10px] font-medium ${
                        outputFormat === 'json' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >JSON</button>
                    <button
                      onClick={() => setOutputFormat('base64')}
                      className={`px-2 py-1 rounded text-[10px] font-medium ${
                        outputFormat === 'base64' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400'
                      }`}
                    >Base64</button>
                  </div>
                </div>

                {/* Group info */}
                <div className="mb-3 p-2 rounded-lg bg-slate-900/40 border border-slate-700/30 text-[11px] text-slate-400">
                  {data.groups.get(selectedKey)!.isVIP ? (
                    <span>
                      <i className="fas fa-crown text-amber-400 ml-1"></i>
                      Custom Config (تک کانفیگ) • {data.groups.get(selectedKey)!.proxies[0].name}
                    </span>
                  ) : (
                    <span>
                      <i className="fas fa-shuffle text-green-400 ml-1"></i>
                      {data.groups.get(selectedKey)!.proxies.length} outbound • Balancer: leastLoad
                    </span>
                  )}
                </div>

                <pre
                  className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/40 text-[10px] font-mono text-emerald-400 overflow-auto max-h-80 text-left"
                  dir="ltr"
                >
                  {getOutput()}
                </pre>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => copy(getOutput(), 'config')}
                    className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40 text-xs flex items-center gap-1.5"
                  >
                    <i className={`fas ${copied === 'config' ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                    {copied === 'config' ? 'کپی شد!' : 'کپی'}
                  </button>
                  <button
                    onClick={() => download(getOutput(), `${data.groups.get(selectedKey)!.country}-config.json`)}
                    className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/40 text-xs flex items-center gap-1.5"
                  >
                    <i className="fas fa-download"></i> دانلود
                  </button>
                </div>
              </section>
            )}

            {/* Bulk Export */}
            <section className="bg-slate-800/40 rounded-2xl border border-slate-700/40 p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <i className="fas fa-boxes-stacked text-cyan-400"></i>
                خروجی یکجا
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const all = mergedGroups.map(g => configToJson(buildMergedConfig(g.country, g.tag, g.proxies))).join('\n\n');
                    copy(all, 'all-merged');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-xs font-medium shadow flex items-center gap-1.5"
                >
                  <i className={`fas ${copied === 'all-merged' ? 'fa-check' : 'fa-copy'}`}></i>
                  {copied === 'all-merged' ? 'کپی شد!' : 'کپی همه ترکیبی‌ها'}
                </button>
                <button
                  onClick={() => {
                    const all = vipGroups.map(g => configToJson(buildSingleConfig(g.proxies[0]))).join('\n\n');
                    copy(all, 'all-vip');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-xs font-medium shadow flex items-center gap-1.5"
                >
                  <i className={`fas ${copied === 'all-vip' ? 'fa-check' : 'fa-copy'}`}></i>
                  {copied === 'all-vip' ? 'کپی شد!' : 'کپی همه VIP‌ها'}
                </button>
                <button
                  onClick={() => {
                    const all = [
                      ...mergedGroups.map(g => configToJson(buildMergedConfig(g.country, g.tag, g.proxies))),
                      ...vipGroups.map(g => configToJson(buildSingleConfig(g.proxies[0]))),
                    ].join('\n\n');
                    copy(all, 'all');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-xs font-medium shadow flex items-center gap-1.5"
                >
                  <i className={`fas ${copied === 'all' ? 'fa-check' : 'fa-copy'}`}></i>
                  {copied === 'all' ? 'کپی شد!' : 'کپی همه'}
                </button>
              </div>
            </section>
          </>
        )}

        {/* Info */}
        {!data && (
          <section className="bg-slate-800/30 rounded-2xl border border-slate-700/30 p-6">
            <div className="grid md:grid-cols-3 gap-4 text-xs text-slate-400">
              <div>
                <h3 className="text-white font-medium mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px]">1</span>
                  دریافت
                </h3>
                <p>ساب‌لینک را وارد کنید. نرم‌افزار به آدرس اصلی می‌رود و تمام کانفیگ‌ها را دریافت می‌کند.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 text-[10px]">2</span>
                  دسته‌بندی
                </h3>
                <p>بر اساس کشور و تگ ([CF], [Direct], [FS]) گروه‌بندی. VIP ها جداگانه.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center text-green-400 text-[10px]">3</span>
                  ترکیب
                </h3>
                <p>هر گروه با balancer leastLoad ترکیب می‌شود. VIP ها به صورت custom config.</p>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-700/40 mt-8 py-4 text-center text-[10px] text-slate-600">
        Config Merger • Xray • FinalMask • leastLoad Balancer
      </footer>
    </div>
  );
}

export default App;

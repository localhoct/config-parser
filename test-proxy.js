// تست پروکسی مرورگر: ۱) HTML صفحه  ۲) APIهای صفحه (/info /links /apps)
// استفاده:  node test-proxy.js <TOKEN>      (یا: TOKEN=... node test-proxy.js)
const http = require('http');

const TOKEN = process.argv[2] || process.env.TOKEN;
const BASE = process.env.BASE_URL || 'http://localhost:3000';

if (!TOKEN) {
  console.error('Usage: node test-proxy.js <TOKEN>');
  process.exit(1);
}

function get(path, headers) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

(async () => {
  const sub = `/sub/${TOKEN}`;

  // 1) صفحه‌ی HTML (مثل مرورگر، با br هم)
  const page = await get(sub, {
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'Mozilla/5.0',
  });
  const ct = page.res.headers['content-type'] || '';
  const enc = page.res.headers['content-encoding'] || 'none';
  console.log(`[HTML ] ${page.res.statusCode} content-type=${ct} encoding=${enc} size=${page.body.length}`);
  console.log(ct.includes('text/html') ? '  ✓ content-type is HTML' : '  ✗ content-type is NOT HTML');
  if (enc === 'none') {
    console.log(page.body.toString('utf8').includes('<html') ? '  ✓ body looks like HTML' : '  ✗ body does not look like HTML');
  } else {
    console.log('  (body is compressed and passed through unchanged — expected)');
  }

  // 2) /info دقیقاً مثل fetch صفحه
  const info = await get(`${sub}/info`, { Accept: 'application/json', 'Accept-Encoding': 'identity' });
  console.log(`[INFO ] ${info.res.statusCode} content-type=${info.res.headers['content-type']}`);
  try {
    const data = JSON.parse(info.body.toString('utf8'));
    if (Array.isArray(data)) {
      console.log('  ✗ got an ARRAY (config-processing branch) — /info must be proxied, not processed');
    } else {
      console.log('  ✓ got an object with keys:', Object.keys(data).join(', '));
    }
  } catch (e) {
    console.log('  ✗ response is not JSON:', e.message);
  }

  // 3) /links (بدون Accept خاص، مثل fetch صفحه)
  const links = await get(`${sub}/links`, { 'Accept-Encoding': 'identity' });
  const text = links.body.toString('utf8');
  console.log(`[LINKS] ${links.res.statusCode} lines=${text.split(/\r?\n/).filter(Boolean).length}`);
  console.log(text.trim().startsWith('[') ? '  ✗ looks like a JSON array (processed) — should be raw links' : '  ✓ not processed');

  // 4) /apps
  const apps = await get(`${sub}/apps`, { Accept: 'application/json', 'Accept-Encoding': 'identity' });
  console.log(`[APPS ] ${apps.res.statusCode} size=${apps.body.length}`);
})().catch((e) => console.error('Error:', e.message));

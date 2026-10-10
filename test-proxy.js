const http = require('http');

const testUrl = 'http://localhost:3000/sub/djMsMTE0OTMsMTc5MTY1NTA4Nw.ITOLc0RJBcgefRvf4S-8AegrKXVWjmH4x9Eb3LsxeBY';

console.log('Testing browser request (Accept: text/html)...');
console.log('URL:', testUrl);
console.log('---');

const req = http.get(testUrl, {
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('---');
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response length:', data.length, 'bytes');
    console.log('---');
    
    // Check if HTML contains user info
    if (data.includes('AzadShop_48d2f954')) {
      console.log('✓ Username found in HTML');
    } else {
      console.log('✗ Username NOT found in HTML');
    }
    
    if (data.includes('۵۰٫۰ گیگابایت')) {
      console.log('✓ Data limit found in HTML');
    } else {
      console.log('✗ Data limit NOT found in HTML');
    }
    
    if (data.includes('۳۰ روز')) {
      console.log('✓ Expire date found in HTML');
    } else {
      console.log('✗ Expire date NOT found in HTML');
    }
    
    // Check if links are rewritten
    if (data.includes('localhost:3000')) {
      console.log('✓ Links rewritten to localhost:3000');
    } else if (data.includes('www.software4you.ir')) {
      console.log('✗ Links still point to www.software4you.ir');
    }
    
    console.log('---');
    console.log('First 500 chars:');
    console.log(data.substring(0, 500));
  });
});

req.on('error', (err) => {
  console.error('Error:', err.message);
});

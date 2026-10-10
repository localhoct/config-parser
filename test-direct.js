#!/usr/bin/env node

const https = require('https');

const url = 'https://www.software4you.ir/sub/djMsMTE0OTMsMTc5MTY1NTA4Nw.ITOLc0RJBcgefRvf4S-8AegrKXVWjmH4x9Eb3LsxeBY';

console.log('Testing direct request to original server...\n');

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  }
};

https.get(url, options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  console.log('---');
  
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const data = Buffer.concat(chunks);
    console.log('Response size:', data.length, 'bytes');
    console.log('---');
    
    // Try to decompress if gzip
    let html = data.toString('utf-8');
    
    // Check if contains user info
    if (html.includes('AzadShop_48d2f954')) {
      console.log('✓ Username found in HTML');
    } else {
      console.log('✗ Username NOT found in HTML');
    }
    
    if (html.includes('۵۰٫۰ گیگابایت')) {
      console.log('✓ Data limit found in HTML');
    } else {
      console.log('✗ Data limit NOT found in HTML');
    }
    
    console.log('---');
    console.log('First 500 chars:');
    console.log(html.substring(0, 500));
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});

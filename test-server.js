#!/usr/bin/env node

/**
 * تست سرور Config Merger
 * 
 * این اسکریپت دو نوع درخواست را تست می‌کند:
 * 1. درخواست از مرورگر (Accept: text/html)
 * 2. درخواست از کلاینت (Accept: application/json)
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const SUB_PATH = '/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4';

console.log('🧪 تست سرور Config Merger\n');
console.log(`📡 آدرس سرور: ${BASE_URL}`);
console.log(`🔗 مسیر ساب: ${SUB_PATH}\n`);

// تست 1: درخواست از مرورگر
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌐 تست 1: درخواست از مرورگر');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const browserReq = http.get(`${BASE_URL}${SUB_PATH}`, {
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`✅ Status Code: ${res.statusCode}`);
    console.log(`✅ Content-Type: ${res.headers['content-type']}`);
    console.log(`✅ Subscription-Userinfo: ${res.headers['subscription-userinfo'] || 'N/A'}`);
    console.log(`✅ Profile-Update-Interval: ${res.headers['profile-update-interval'] || 'N/A'}`);
    console.log(`✅ Profile-Title: ${res.headers['profile-title'] || 'N/A'}`);
    console.log(`✅ Response Size: ${data.length} bytes`);
    console.log(`✅ Response Preview: ${data.substring(0, 200)}...`);
    console.log();
    
    // تست 2: درخواست از کلاینت
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 تست 2: درخواست از کلاینت');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const clientReq = http.get(`${BASE_URL}${SUB_PATH}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'v2rayN/6.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ Status Code: ${res.statusCode}`);
        console.log(`✅ Content-Type: ${res.headers['content-type']}`);
        console.log(`✅ Subscription-Userinfo: ${res.headers['subscription-userinfo'] || 'N/A'}`);
        console.log(`✅ Profile-Update-Interval: ${res.headers['profile-update-interval'] || 'N/A'}`);
        console.log(`✅ Profile-Title: ${res.headers['profile-title'] || 'N/A'}`);
        console.log(`✅ Response Size: ${data.length} bytes`);
        
        try {
          const configs = JSON.parse(data);
          console.log(`✅ Configs Count: ${configs.length}`);
          console.log(`✅ First Config Remarks: ${configs[0]?.remarks || 'N/A'}`);
        } catch (e) {
          console.log(`❌ JSON Parse Error: ${e.message}`);
        }
        
        console.log();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ تست‌ها کامل شد!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      });
    });
    
    clientReq.on('error', (err) => {
      console.error(`❌ خطا در درخواست کلاینت: ${err.message}`);
    });
  });
});

browserReq.on('error', (err) => {
  console.error(`❌ خطا در درخواست مرورگر: ${err.message}`);
  console.log('\n💡 آیا سرور در حال اجرا است؟');
  console.log('   دستور اجرا: node server.js');
});

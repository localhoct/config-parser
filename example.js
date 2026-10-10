// مثال عملی از رفتار سرور
// این فایل نشان می‌دهد که سرور چگونه کانفیگ‌ها را گروه‌بندی می‌کند

// ورودی فرضی از سرور اصلی (www.software4you.ir):
const sampleInput = [
  // کانفیگ‌های پروکسی آلمان
  { remarks: '🇩🇪 DE • [VIP] 🔥🚀', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇩🇪 DE2 • [VIP] 🔥🚀', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇩🇪 DE3 • [VIP] 🔥🚀', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  
  // کانفیگ‌های پروکسی هلند با تگ [CF]
  { remarks: '🇳🇱 NL [CF]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇳🇱 NL [CF]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇳🇱 NL [CF]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  
  // کانفیگ‌های پروکسی هلند 2 با تگ [CF] - جدا از NL
  { remarks: '🇳🇱 NL2 [CF]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇳🇱 NL2 [CF]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  
  // کانفیگ‌های پروکسی فنلاند با تگ [Direct]
  { remarks: '🇫🇮 FI [Direct]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  { remarks: '🇫🇮 FI [Direct]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  
  // کانفیگ‌های پروکسی فنلاند 2 با تگ [Direct] - جدا از FI
  { remarks: '🇫🇮 FI2 [Direct]', outbounds: [{ tag: 'proxy', protocol: 'vless', /* ... */ }] },
  
  // کانفیگ اطلاعات کاربر (بدون outbound پروکسی)
  { remarks: '⏳ (5.2 GB) / (10 GB)', outbounds: [] },
  { remarks: '📅 2026-12-31 • 45 days left', outbounds: [] },
  { remarks: '✅ Test-User-01', outbounds: [] },
];

// خروجی سرور پس از پردازش:
const sampleOutput = [
  // گروه ترکیبی NL [CF] - 3 پروکسی با balancer
  {
    remarks: '🇳🇱 NL [CF]',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'proxy-2', protocol: 'vless', /* ... */ },
      { tag: 'proxy-3', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
    routing: {
      balancers: [{
        tag: 'auto',
        selector: ['proxy', 'proxy-2', 'proxy-3'],
        strategy: { type: 'leastLoad' },
      }],
      rules: [{ balancerTag: 'auto' }],
    },
  },
  
  // گروه ترکیبی NL2 [CF] - 2 پروکسی با balancer (جدا از NL)
  {
    remarks: '🇳🇱 NL2 [CF]',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'proxy-2', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
    routing: {
      balancers: [{
        tag: 'auto',
        selector: ['proxy', 'proxy-2'],
        strategy: { type: 'leastLoad' },
      }],
      rules: [{ balancerTag: 'auto' }],
    },
  },
  
  // گروه ترکیبی FI [Direct] - 2 پروکسی با balancer
  {
    remarks: '🇫🇮 FI [Direct]',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'proxy-2', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
    routing: {
      balancers: [{
        tag: 'auto',
        selector: ['proxy', 'proxy-2'],
        strategy: { type: 'leastLoad' },
      }],
      rules: [{ balancerTag: 'auto' }],
    },
  },
  
  // گروه ترکیبی FI2 [Direct] - 1 پروکسی بدون balancer (جدا از FI)
  {
    remarks: '🇫🇮 FI2 [Direct]',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
    routing: {
      rules: [{ outboundTag: 'proxy' }],  // بدون balancer چون فقط 1 پروکسی
    },
  },
  
  // کانفیگ‌های VIP - بدون ترکیب
  {
    remarks: '🇩🇪 DE • [VIP] 🔥🚀',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
  },
  {
    remarks: '🇩🇪 DE2 • [VIP] 🔥🚀',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
  },
  {
    remarks: '🇩🇪 DE3 • [VIP] 🔥🚀',
    outbounds: [
      { tag: 'proxy', protocol: 'vless', /* ... */ },
      { tag: 'DIRECT', protocol: 'freedom', settings: {} },
      { tag: 'BLOCK', protocol: 'blackhole', settings: {} },
    ],
  },
  
  // کانفیگ‌های اطلاعات کاربر - بدون تغییر
  { remarks: '⏳ (5.2 GB) / (10 GB)', outbounds: [] },
  { remarks: '📅 2026-12-31 • 45 days left', outbounds: [] },
  { remarks: '✅ Test-User-01', outbounds: [] },
];

console.log('=== مثال عملی ===\n');
console.log('ورودی:', sampleInput.length, 'کانفیگ');
console.log('خروجی:', sampleOutput.length, 'کانفیگ\n');

console.log('گروه‌بندی:');
console.log('  🇳🇱 NL [CF]   → 3 پروکسی → 1 کانفیگ با balancer');
console.log('  🇳🇱 NL2 [CF]  → 2 پروکسی → 1 کانفیگ با balancer (جدا)');
console.log('  🇫🇮 FI [Direct]  → 2 پروکسی → 1 کانفیگ با balancer');
console.log('  🇫🇮 FI2 [Direct] → 1 پروکسی → 1 کانفیگ بدون balancer (جدا)');
console.log('  🇩🇪 DE • [VIP]   → 1 کانفیگ جداگانه');
console.log('  🇩🇪 DE2 • [VIP]  → 1 کانفیگ جداگانه (جدا)');
console.log('  🇩🇪 DE3 • [VIP]  → 1 کانفیگ جداگانه (جدا)');
console.log('  اطلاعات کاربر    → 3 کانفیگ بدون تغییر\n');

console.log('✅ تمام ایموجی‌ها و نام‌ها حفظ شدند');
console.log('✅ FinalMask اصلی کانفیگ‌ها حفظ شد');
console.log('✅ DE, DE2, DE3 جداگانه گروه‌بندی شدند');
console.log('✅ اطلاعات کاربر بدون تغییر در انتهای خروجی');

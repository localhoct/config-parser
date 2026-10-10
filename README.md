# Config Merger Server

سرور ساده Node.js که ساب‌لینک پروکسی‌ها را دریافت و بر اساس کشور و تگ ترکیب می‌کند.

## 🎯 نحوه کار

1. کاربر به `http://your-server:3000/sub/<path>` درخواست می‌زند
2. سرور به `https://www.software4you.ir/sub/<path>` درخواست می‌دهد
3. کانفیگ‌های JSON را دریافت می‌کند
4. بر اساس کشور (DE, NL, FI, ...) و تگ ([CF], [Direct], [FS]) گروه‌بندی می‌کند
5. هر گروه را با balancer `leastLoad` ترکیب می‌کند
6. کانفیگ‌های VIP را جداگانه خروجی می‌دهد
7. نتیجه را به کاربر برمی‌گرداند

## 🚀 نصب و اجرا

```bash
# نصب (نیازی به پکیج اضافی نیست)
# فقط Node.js 18+ نیاز است

# اجرا
node server.js

# یا با watch mode (برای توسعه)
node --watch server.js
```

## 📡 استفاده

### مثال:
```
http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4
```

### خروجی:
آرایه‌ای از کانفیگ‌های JSON که هر کدام شامل:
- **گروه‌های ترکیبی**: چندین outbound با balancer leastLoad
- **کانفیگ‌های VIP**: تک outbound بدون balancer

## 🔧 منطق گروه‌بندی

### گروه‌های ترکیبی (با Balancer):
```
🇳🇱 NL [CF]     → تمام پروکسی‌های NL با تگ [CF] → 1 کانفیگ با balancer
🇩🇪 DE [Direct]  → تمام پروکسی‌های DE با تگ [Direct] → 1 کانفیگ با balancer
🇫🇮 FI [CF]     → تمام پروکسی‌های FI با تگ [CF] → 1 کانفیگ با balancer
```

### کانفیگ‌های VIP (بدون ترکیب):
```
🇩🇪 DE • [VIP] 🔥🚀 → 1 کانفیگ جداگانه
🇺🇸 US • [VIP] 🔥🚀 → 1 کانفیگ جداگانه
```

## 📦 ساختار کانفیگ خروجی

### گروه ترکیبی:
```json
{
  "remarks": "🇳🇱 NL [CF]",
  "outbounds": [
    { "tag": "proxy", "protocol": "vless", ... },
    { "tag": "proxy-2", "protocol": "vless", ... },
    { "tag": "proxy-3", "protocol": "vless", ... },
    { "tag": "DIRECT", "protocol": "freedom" },
    { "tag": "BLOCK", "protocol": "blackhole" }
  ],
  "routing": {
    "balancers": [{
      "tag": "auto",
      "selector": ["proxy", "proxy-2", "proxy-3"],
      "strategy": { "type": "leastLoad" }
    }],
    "rules": [{ "balancerTag": "auto" }]
  }
}
```

### کانفیگ VIP:
```json
{
  "remarks": "🇩🇪 DE • [VIP] 🔥🚀",
  "outbounds": [
    { "tag": "proxy", "protocol": "vless", ... },
    { "tag": "DIRECT", "protocol": "freedom" },
    { "tag": "BLOCK", "protocol": "blackhole" }
  ],
  "routing": {
    "rules": [{ "outboundTag": "proxy" }]
  }
}
```

## 🎨 ویژگی‌ها

- ✅ دریافت خودکار از `www.software4you.ir`
- ✅ تشخیص کشور از flag emoji یا کد 2 حرفی
- ✅ تشخیص تگ‌ها: [CF], [Direct], [VIP], [FS], ...
- ✅ ترکیب پروکسی‌های هم‌گروه با balancer `leastLoad`
- ✅ VIP ها به صورت custom config جداگانه
- ✅ حفظ FinalMask اصلی کانفیگ (بدون تغییر)
- ✅ حفظ کانفیگ‌های اطلاعات کاربر و مصرف بدون تغییر
- ✅ BurstObservatory برای پینگ خودکار
- ✅ بدون نیاز به فرانت‌اند
- ✅ بدون نیاز به CORS proxy
- ✅ کاملاً سمت سرور

## 🔐 Deployment با Nginx + SSL

```nginx
server {
    listen 443 ssl http2;
    server_name forsubs.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /sub/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Subscription headers
        add_header Content-Type 'application/json; charset=utf-8';
        add_header Profile-Update-Interval '24';
    }
}
```

## 📱 استفاده در کلاینت

لینک ساب نهایی:
```
https://forsubs.yourdomain.com/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4
```

این لینک را در کلاینت‌های زیر وارد کنید:
- **v2rayN** (Windows)
- **v2rayNG** (Android)
- **FlClash** (Cross-platform)
- **Streisand** (iOS)
- **V2Box** (iOS/Android)

## ⚙️ تنظیمات

### تغییر پورت:
```bash
PORT=8080 node server.js
```

### Environment Variables:
- `PORT`: پورت سرور (پیش‌فرض: 3000)

## 🛠️ تکنولوژی‌ها

- Node.js (بدون dependency خارجی)
- HTTP/HTTPS modules
- Xray Core config format

## 📝 نکات

- سرور به صورت خودکار `forsubs.software4you.ir` را به `www.software4you.ir` تبدیل می‌کند
- **FinalMask اصلی کانفیگ حفظ می‌شود** - سرور هیچ FinalMask جدیدی اضافه نمی‌کند
- **کانفیگ‌های اطلاعات کاربر و مصرف** (مثل حجم، تاریخ، یوزر) بدون هیچ تغییری در خروجی قرار می‌گیرند
- اگر فقط یک پروکسی در گروه باشد، balancer حذف می‌شود
- کانفیگ‌های VIP هیچ تغییری نمی‌کنند (فقط outbound اصلی با همان تنظیمات)

## 🐛 عیب‌یابی

### خطا در دریافت ساب‌لینک:
```
Error: Failed to parse subscription data
```
- بررسی کنید که ساب‌لینک معتبر است
- بررسی کنید که `www.software4you.ir` در دسترس است

### خروجی خالی:
- بررسی کنید که ساب‌لینک شامل کانفیگ‌های JSON است
- لاگ سرور را بررسی کنید

## 📄 لایسنس

MIT

# Config Merger Server

سرور ترکیب کانفیگ‌های Xray با قابلیت **Reverse Proxy کامل**

## 🎯 نحوه کار

### 🔄 Reverse Proxy Mode (برای مرورگر)
- **درخواست مرورگر** → Proxy به سرور اصلی
- صفحه HTML کامل از سرور اصلی دریافت و به مرورگر ارسال می‌شود
- JavaScript در مرورگر اجرا شده و اطلاعات را از API های سرور اصلی دریافت می‌کند
- تمام درخواست‌های API (`/info`, `/links`, `/apps`, `/usage`) نیز proxy می‌شوند
- کاربر صفحه کامل با تمام اطلاعات را می‌بیند

### 🔀 Config Processing Mode (برای کلاینت)
- **درخواست کلاینت با هدر `X-Merged-Configs: true`** → پردازش و ترکیب کانفیگ‌ها
- تشخیص خودکار کشور و تگ
- ساخت balancer leastLoad
- حفظ FinalMask اصلی

### منطق پردازش:
1. کاربر به `http://your-server:3000/sub/<path>` درخواست می‌زند
2. سرور درخواست را بررسی می‌کند:
   - اگر `Accept: text/html` باشد (مرورگر) → **Proxy به سرور اصلی**
   - اگر `X-Merged-Configs: true` باشد (کلاینت) → **پردازش کانفیگ‌ها**
   - در غیر این صورت → **Proxy به سرور اصلی**
3. برای مرورگر:
   - تمام درخواست‌ها (HTML + API) به سرور اصلی proxy می‌شوند
   - JavaScript در مرورگر اجرا شده و اطلاعات را از API ها دریافت می‌کند
   - کاربر صفحه کامل با تمام اطلاعات را می‌بیند
4. برای کلاینت:
   - کانفیگ‌ها از سرور اصلی دریافت می‌شوند
   - بر اساس کشور (DE, NL, FI, ...) و تگ ([CF], [Direct], [FS]) گروه‌بندی می‌شوند
   - هر گروه با balancer `leastLoad` ترکیب می‌شود
   - کانفیگ‌های VIP جداگانه خروجی داده می‌شوند
   - نتیجه به کلاینت برگردانده می‌شود

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

### مرورگر (صفحه اطلاعات کاربر):
```
http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4
```
→ صفحه کامل با اطلاعات کاربر، لینک‌ها، اپلیکیشن‌ها و نمودار مصرف

### کلاینت (کانفیگ‌های ترکیبی):
```bash
curl -H "Accept: application/json" \
  http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4
```
→ کانفیگ‌های JSON ترکیبی با balancer

### مثال عملی:

**ورودی** (از سرور اصلی):
```
🇩🇪 DE • [VIP] 🔥🚀
🇩🇪 DE2 • [VIP] 🔥🚀
🇩🇪 DE3 • [VIP] 🔥🚀
🇳🇱 NL [CF] (3x)
🇳🇱 NL2 [CF] (2x)
🇫🇮 FI [Direct] (2x)
🇫🇮 FI2 [Direct] (1x)
⏳ (5.2 GB) / (10 GB)
📅 2026-12-31 • 45 days left
✅ Test-User-01
```

**خروجی** (پس از پردازش با هدر `X-Merged-Configs: true`):
```
✅ 🇳🇱 NL [CF] → 3 پروکسی → 1 کانفیگ با balancer
✅ 🇳🇱 NL2 [CF] → 2 پروکسی → 1 کانفیگ با balancer (جدا از NL) ← پرچم 🇳🇱 حفظ شد
✅ 🇫🇮 FI [Direct] → 2 پروکسی → 1 کانفیگ با balancer
✅ 🇫🇮 FI2 [Direct] → 1 پروکسی → 1 کانفیگ بدون balancer (جدا از FI) ← پرچم 🇫🇮 حفظ شد
✅ 🇩🇪 DE • [VIP] → 1 کانفیگ جداگانه
✅ 🇩🇪 DE2 • [VIP] → 1 کانفیگ جداگانه (جدا از DE) ← پرچم 🇩🇪 حفظ شد
✅ 🇩🇪 DE3 • [VIP] → 1 کانفیگ جداگانه (جدا از DE و DE2) ← پرچم 🇩🇪 حفظ شد
✅ ⏳ (5.2 GB) / (10 GB) → بدون تغییر
✅ 📅 2026-12-31 • 45 days left → بدون تغییر
✅ ✅ Test-User-01 → بدون تغییر
```

### خروجی:
آرایه‌ای از کانفیگ‌های JSON که هر کدام شامل:
- **گروه‌های ترکیبی**: چندین outbound با balancer leastLoad
- **کانفیگ‌های VIP**: تک outbound بدون balancer
- **کانفیگ‌های اطلاعات کاربر**: دقیقاً همانطور که از سرور اصلی دریافت شده

### 🔑 هدرهای پاس داده شده:

سرور هدرهای اصلی از سرور `www.software4you.ir` را به کلاینت پاس می‌دهد:

| Header | توضیح |
|--------|-------|
| `subscription-userinfo` | اطلاعات کاربر (upload, download, total, expire) |
| `profile-update-interval` | فاصله زمانی آپدیت (مثلاً 24 ساعت) |
| `profile-title` | عنوان پروفایل (base64 encoded) |
| `profile-web-page-url` | آدرس صفحه وب |
| `support-url` | آدرس پشتیبانی |
| `announce` | پیام اطلاع‌رسانی (base64 encoded) |
| `announce-url` | آدرس اطلاع‌رسانی |
| `content-disposition` | نام فایل برای دانلود |
| `cache-control` | تنظیمات کش |

### 📱 مثال هدرهای خروجی:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
subscription-userinfo: upload=0; download=5368709120; total=10737418240; expire=1735689600
profile-update-interval: 24
profile-title: base64:VGVzdCBVc2Vy
profile-web-page-url: https://www.software4you.ir/sub/...
support-url: https://t.me/support
announce: base64:SGVsbG8gV29ybGQ=
announce-url: https://t.me/announcements
content-disposition: attachment; filename="merged-configs.json"
cache-control: no-store
```

## 🔧 منطق گروه‌بندی

### گروه‌های ترکیبی (با Balancer):
```
🇳🇱 NL [CF]      → تمام پروکسی‌های NL با تگ [CF] → 1 کانفیگ با balancer
🇳🇱 NL2 [CF]     → تمام پروکسی‌های NL2 با تگ [CF] → 1 کانفیگ با balancer (جدا از NL)
🇳🇱 NL5 [CF]     → تمام پروکسی‌های NL5 با تگ [CF] → 1 کانفیگ با balancer (جدا از NL و NL2)
🇩🇪 DE [Direct]   → تمام پروکسی‌های DE با تگ [Direct] → 1 کانفیگ با balancer
🇩🇪 DE2 [Direct]  → تمام پروکسی‌های DE2 با تگ [Direct] → 1 کانفیگ با balancer (جدا از DE)
🇩🇪 DE3 [Direct]  → تمام پروکسی‌های DE3 با تگ [Direct] → 1 کانفیگ با balancer (جدا از DE و DE2)
🇩🇪 DE10 [Direct] → تمام پروکسی‌های DE10 با تگ [Direct] → 1 کانفیگ با balancer
🇫🇮 FI [CF]      → تمام پروکسی‌های FI با تگ [CF] → 1 کانفیگ با balancer
🇯🇵 JP5 [FS]     → تمام پروکسی‌های JP5 با تگ [FS] → 1 کانفیگ با balancer
🇬🇧 GB2 [VIP]    → تمام پروکسی‌های GB2 با تگ [VIP] → 1 کانفیگ با balancer
```

**نکته**: هر کشور با هر عددی (1، 2، 3، 10، ...) به صورت جداگانه گروه‌بندی می‌شود. این برای همه کشورها اعمال می‌شود.

### کانفیگ‌های VIP (بدون ترکیب):
```
🇩🇪 DE • [VIP] 🔥🚀 → 1 کانفیگ جداگانه
🇩🇪 DE2 • [VIP] 🔥🚀 → 1 کانفیگ جداگانه (جدا از DE)
🇺🇸 US • [VIP] 🔥🚀 → 1 کانفیگ جداگانه
```

### کانفیگ‌های اطلاعات کاربر (بدون تغییر):
```
⏳ (0 B) / (∞) → اطلاعات حجم مصرفی - بدون تغییر
📅 ∞ • ∞       → اطلاعات تاریخ انقضا - بدون تغییر
✅ Test-01      → اطلاعات کاربر - بدون تغییر
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

### 🔄 Reverse Proxy کامل (برای مرورگر)
- ✅ **Proxy کامل** تمام درخواست‌ها به سرور اصلی
- ✅ پشتیبانی از **gzip/deflate decompression**
- ✅ نمایش کامل صفحه اطلاعات کاربر با JavaScript
- ✅ تمام API calls (`/info`, `/links`, `/apps`, `/usage`) proxy می‌شوند
- ✅ تمام لینک‌ها، اپلیکیشن‌ها، QR code ها و نمودار مصرف
- ✅ بدون نیاز به redirect یا پردازش اضافی

### 🔀 پردازش کانفیگ (برای کلاینت)
- ✅ تشخیص خودکار مرورگر از کلاینت (بر اساس `Accept` header)
- ✅ دریافت خودکار از `www.software4you.ir`
- ✅ تشخیص کشور از flag emoji یا کد 2 حرفی
- ✅ **حفظ پرچم اصلی** از remarks کانفیگ (حتی برای DE2, NL5, FI10)
- ✅ تشخیص تگ‌ها: [CF], [Direct], [VIP], [FS], ...
- ✅ ترکیب پروکسی‌های هم‌گروه با balancer `leastLoad`
- ✅ VIP ها به صورت custom config جداگانه
- ✅ حفظ FinalMask اصلی کانفیگ (بدون تغییر)
- ✅ حفظ کانفیگ‌های اطلاعات کاربر و مصرف بدون تغییر
- ✅ BurstObservatory برای پینگ خودکار

### 📡 پشتیبانی فرمت‌ها
- ✅ JSON
- ✅ Base64-encoded JSON
- ✅ Plain text links (vless://, trojan://, ss://)
- ✅ Base64-encoded plain text

### 🛠️ عمومی
- ✅ بدون نیاز به فرانت‌اند
- ✅ بدون نیاز به dependency خارجی
- ✅ کاملاً سمت سرور
- ✅ پشتیبانی از CORS
- ✅ پشتیبانی از gzip/deflate compression

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

### 🔄 Reverse Proxy Mode (برای مرورگر)
- **درخواست مرورگر** - تمام درخواست‌ها (HTML + API) به سرور اصلی proxy می‌شوند
- **gzip/deflate decompression** - پاسخ‌های فشرده به صورت خودکار decompress می‌شوند
- **صفحه کامل** - کاربر تمام اطلاعات کاربر، لینک‌ها، اپلیکیشن‌ها و نمودار مصرف را می‌بیند
- **API Endpoints** - تمام endpoint های `/sub/{token}/info`, `/links`, `/apps`, `/usage` proxy می‌شوند
- **بدون redirect** - کاربر در همان دامنه شما می‌ماند

### 🔀 Config Processing Mode (برای کلاینت)
- **تشخیص خودکار** - بر اساس `Accept` header
  - `Accept: text/html` → Proxy به سرور اصلی (مرورگر)
  - `Accept: application/json` یا `text/plain` → کانفیگ‌های ترکیبی (کلاینت)
- سرور به صورت خودکار `forsubs.software4you.ir` را به `www.software4you.ir` تبدیل می‌کند
- **FinalMask اصلی کانفیگ حفظ می‌شود** - سرور هیچ FinalMask جدیدی اضافه نمی‌کند
- **پرچم اصلی حفظ می‌شود** - حتی برای DE2, NL5, FI10 پرچم 🇩🇪, 🇳🇱, 🇫🇮 از remarks اصلی استخراج می‌شود
- **کشورها با شماره جدا هستند** - DE, DE2, DE3 سه گروه جداگانه هستند
- **کانفیگ‌های اطلاعات کاربر و مصرف** (مثل حجم، تاریخ، یوزر) بدون هیچ تغییری در خروجی قرار می‌گیرند
- **ایموجی و نام‌ها دست نمی‌خورند** - تمام remarks اصلی حفظ می‌شوند
- **کانفیگ‌های منقضی شده** (حجم تمام شده، تاریخ تمام شده) دقیقاً همانطور که هستند برگردانده می‌شوند
- **هدرهای اصلی سرور پاس داده می‌شوند** - subscription-userinfo, profile-update-interval, profile-title و...
- **پشتیبانی از چندین فرمت** - JSON، Base64، Plain text links
- اگر فقط یک پروکسی در گروه باشد، balancer حذف می‌شود
- کانفیگ‌های VIP هیچ تغییری نمی‌کنند (فقط outbound اصلی با همان تنظیمات)

## 🧪 تست سرور

برای تست سرور، از اسکریپت `test-server.js` استفاده کنید:

```bash
# ابتدا سرور را اجرا کنید
node server.js

# در یک ترمینال دیگر، تست را اجرا کنید
node test-server.js
```

این اسکریپت دو نوع درخواست را تست می‌کند:
1. **درخواست مرورگر** - باید HTML برگرداند (proxy به سرور اصلی)
2. **درخواست کلاینت** - باید کانفیگ‌های ترکیبی JSON برگرداند

همچنین می‌توانید با curl تست کنید:

```bash
# تست درخواست مرورگر (proxy به سرور اصلی)
curl -H "Accept: text/html" http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4

# تست درخواست کلاینت (کانفیگ‌های ترکیبی)
curl -H "Accept: application/json" http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4

# تست API endpoints (proxy به سرور اصلی)
curl http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4/info
curl http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4/links
curl http://localhost:3000/sub/djMsMTE0NzUsMTc5MTYyOTk5Ng.gRa-kQmo6Ht9ZB8OPuuldV8tL-LAcrFCtzi4J5o-9V4/apps
```

## 🔄 گردش کار کامل

### حالت ۱: درخواست از مرورگر (Reverse Proxy)
```
1. کاربر لینک را در مرورگر باز می‌کند
2. سرور تشخیص می‌دهد Accept: text/html
3. درخواست به سرور اصلی proxy می‌شود
4. HTML اصلی دریافت و به مرورگر ارسال می‌شود
5. JavaScript در مرورگر اجرا می‌شود
6. JavaScript به API های سرور اصلی درخواست می‌زند:
   - /sub/{token}/info → اطلاعات کاربر
   - /sub/{token}/links → لینک‌های کانفیگ
   - /sub/{token}/apps → اپلیکیشن‌ها
   - /sub/{token}/usage → نمودار مصرف
7. تمام این درخواست‌ها نیز proxy می‌شوند
8. کاربر صفحه کامل با تمام اطلاعات را می‌بیند
```

### حالت ۲: درخواست از کلاینت (v2rayN, FlClash, ...)
```
1. کلاینت با Accept: application/json یا text/plain درخواست می‌زند
2. سرور تشخیص می‌دهد این یک کلاینت است (نه مرورگر)
3. سرور به www.software4you.ir درخواست می‌دهد
4. کانفیگ‌های JSON دریافت می‌شوند
5. کانفیگ‌ها بر اساس کشور و تگ گروه‌بندی می‌شوند
6. هر گروه با balancer leastLoad ترکیب می‌شود
7. کانفیگ‌های VIP جداگانه نگه داشته می‌شوند
8. کانفیگ‌های اطلاعات کاربر بدون تغییر اضافه می‌شوند
9. کانفیگ‌های نهایی + هدرهای اصلی به کلاینت برگردانده می‌شوند
10. کلاینت کانفیگ‌ها را import می‌کند
```

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

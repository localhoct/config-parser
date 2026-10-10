# Config Merger - نسخه ساده (بدون سرور)

## 🎯 معرفی

یک ابزار فرانت‌اند ساده که ساب‌لینک پروکسی‌ها را دریافت کرده و بر اساس **کشور** و **تگ** ([CF], [Direct], [FS]) گروه‌بندی و ترکیب می‌کند.

## 🔄 منطق کار

### ورودی:
```
https://forsubs.software4you.ir/sub/...
```

### تبدیل به:
```
https://www.software4you.ir/sub/...
```

### پردازش:
1. تمام کانفیگ‌ها از ساب‌لینک دریافت می‌شوند
2. هر کانفیگ بر اساس نام دسته‌بندی می‌شود:
   - **کشور**: از flag emoji یا کد 2 حرفی (DE, NL, FI, US, ...)
   - **تگ**: از براکت [CF], [Direct], [FS], ...
   - **VIP**: اگر `[VIP]` در نام باشد

### خروجی:

#### گروه‌های ترکیبی (با Balancer):
```
🇳🇱 NL [CF]    → 5 پروکسی → 1 کانفیگ با balancer leastLoad
🇩🇪 DE [Direct] → 3 پروکسی → 1 کانفیگ با balancer leastLoad
🇫🇮 FI [CF]    → 2 پروکسی → 1 کانفیگ با balancer leastLoad
```

#### کانفیگ‌های VIP (بدون ترکیب):
```
🇩🇪 DE • [VIP] 🔥🚀 → 1 کانفیگ جداگانه (Custom Config)
🇺🇸 US • [VIP] 🔥🚀 → 1 کانفیگ جداگانه (Custom Config)
🇳🇱 NL • [VIP] 🔥🚀 → 1 کانفیگ جداگانه (Custom Config)
```

## 📦 ساختار

```
├── src/
│   ├── App.tsx              # UI اصلی
│   ├── utils/
│   │   ├── proxyParser.ts   # Parse لینک‌ها + استخراج کشور/تگ
│   │   ├── subscription.ts  # Fetch ساب‌لینک + گروه‌بندی
│   │   └── configBuilder.ts # ساخت کانفیگ Xray با FinalMask
│   └── index.css
├── index.html
└── dist/                    # خروجی build
```

## 🚀 استفاده

### روش ۱: اجرای محلی
```bash
npm install
npm run dev
```

### روش ۲: Build و Deploy
```bash
npm install
npm run build
# فایل‌های dist/ را روی هر web server بگذارید
```

### روش ۳: استفاده مستقیم
1. ساب‌لینک خود را وارد کنید
2. دکمه "دریافت و پردازش" را بزنید
3. در تب "ترکیبی" گروه‌های [CF], [Direct], [FS] را ببینید
4. در تب "VIP" کانفیگ‌های VIP را ببینید
5. هر کدام را انتخاب و JSON/Base64 کپی کنید
6. در کلاینت (v2rayN, FlClash, v2rayNG) import کنید

## 🎨 ویژگی‌ها

- ✅ تشخیص خودکار کشور از flag emoji یا کد
- ✅ تشخیص تگ‌ها: [CF], [Direct], [VIP], [FS], ...
- ✅ ترکیب پروکسی‌های هم‌گروه با balancer `leastLoad`
- ✅ VIP ها به صورت custom config جداگانه
- ✅ FinalMask templates (POP3, SMTP, RDP)
- ✅ BurstObservatory برای پینگ خودکار
- ✅ خروجی JSON یا Base64
- ✅ بدون نیاز به سرور (کاملاً client-side)

## 🔧 کانفیگ خروجی

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
      "strategy": { "type": "leastLoad", ... }
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

## ⚠️ نکات

- برای fetch ساب‌لینک از CORS proxy استفاده می‌شود (اگر سرور CORS نداشته باشد)
- اگر CORS کار نکرد، از تب "لینک خام" استفاده کنید
- FinalMask templates به صورت چرخشی به outbound های TCP اضافه می‌شوند
- اگر فقط یک پروکسی در گروه باشد، balancer حذف می‌شود

## 📱 کلاینت‌های پشتیبانی شده

- **v2rayN** (Windows): فایل → وارد کردن → از کلیپ‌بورد
- **v2rayNG** (Android): افزودن از کلیپ‌بورد
- **FlClash** (Cross-platform): پروفایل → افزودن → Local
- **Streisand** (iOS): افزودن از لینک
- **V2Box** (iOS/Android): افزودن از کلیپ‌بورد

## 🛠️ تکنولوژی‌ها

- React 18
- TypeScript
- Tailwind CSS 4
- Vite
- Xray Core config format

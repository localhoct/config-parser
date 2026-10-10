# Config Merger - ترکیب هوشمند کانفیگ‌ها

## 🎯 معرفی

این ابزار یک **صفحه واسط** است که:
1. ساب‌لینک پروکسی‌ها را دریافت می‌کند
2. پروکسی‌ها را بر اساس کشور (DE, NL, FI, US, ...) گروه‌بندی می‌کند
3. هر گروه را به یک کانفیگ Xray با **balancer leastLoad** تبدیل می‌کند
4. **FinalMask** templates (POP3, SMTP, RDP, ICMP) را به outbound ها اضافه می‌کند
5. خروجی JSON/Base64 برای استفاده در کلاینت‌ها تولید می‌کند

## 📋 مثال

```
🇳🇱 NL-01, NL-02, ..., NL-09 → یک کانفیگ NL با 9 outbound + balancer
🇩🇪 DE-01, DE-02, DE-03 → یک کانفیگ DE با 3 outbound + balancer
🇫🇮 FI-01, FI-02 → یک کانفیگ FI با 2 outbound + balancer
```

## 🚀 نحوه استفاده

### حالت ۱: فرانت‌اند (مرورگر)
1. ساب‌لینک خود را وارد کنید
2. دکمه "پردازش و ترکیب" را بزنید
3. کشور مورد نظر را انتخاب کنید
4. کانفیگ JSON را کپی کنید
5. در کلاینت (v2rayN, FlClash, v2rayNG) import کنید

### حالت ۲: Backend (Production)
```bash
# Build frontend
npm install
npm run build

# Run backend
cd server
npm install
npm start

# Configure Nginx (see nginx/config.conf)
# Setup SSL with Let's Encrypt
```

## ساختار
```
├── src/                    # React Frontend
│   ├── App.tsx            # کامپوننت اصلی
│   ├── utils/
│   │   ├── proxyParser.ts    # Parse لینک‌های vless/vmess/trojan/ss
│   │   ├── subscription.ts   # Fetch و decode ساب‌لینک
│   │   └── configBuilder.ts  # ساخت کانفیگ Xray با balancer
│   └── index.css
├── server/               # Backend (Express)
│   └── index.js         # API endpoint برای ساب‌لینک
├── nginx/
│   └── config.conf      # Nginx reverse proxy config
└── dist/                # Build output
```

## Deployment

### 1. Build Frontend
```bash
npm install
npm run build
```

### 2. Setup Backend (Node.js)
```bash
cd server
npm install
node index.js
```
سرور روی پورت 3001 اجرا می‌شود.

### 3. Nginx Configuration
فایل `nginx/config.conf` را در `/etc/nginx/sites-available/` کپی کنید:
```bash
sudo cp nginx/config.conf /etc/nginx/sites-available/config-merger
sudo ln -s /etc/nginx/sites-available/config-merger /etc/nginx/sites-enabled/
```

### 4. SSL Certificate (Let's Encrypt)
```bash
sudo certbot --nginx -d your-domain.com
```

### 5. Restart Nginx
```bash
sudo systemctl restart nginx
```

## API Endpoints

### GET /api/sub/merge?url=<subscription_url>
ساب‌لینک را دریافت و کانفیگ‌های ترکیبی را برمی‌گرداند.

**Response:**
```json
{
  "groups": {
    "DE": { "config": {...}, "count": 5 },
    "NL": { "config": {...}, "count": 3 }
  }
}
```

### GET /api/sub/merge/:country
کانفیگ ترکیبی یک کشور خاص را برمی‌گرداند (JSON خام برای کلاینت‌های Xray).

## نحوه کار

1. **دریافت ساب‌لینک**: لینک‌های پروکسی از URL ورودی fetch می‌شوند
2. **Parse**: لینک‌های vless://, vmess://, trojan://, ss:// parse می‌شوند
3. **گروه‌بندی**: بر اساس نام کشور (از flag emoji یا کد 2 حرفی) گروه‌بندی می‌شوند
4. **ترکیب**: هر گروه به یک کانفیگ Xray تبدیل می‌شود با:
   - چندین outbound (هر پروکسی یک outbound)
   - Balancer با استراتژی leastLoad
   - BurstObservatory برای پینگ خودکار
   - Routing rules
   - FinalMask settings (در صورت وجود)
5. **خروجی**: JSON یا Base64 برای استفاده در کلاینت‌ها

## کانفیگ خروجی

هر کانفیگ شامل:
- **remarks**: نام کشور با flag emoji
- **inbounds**: socks (10808) + http (10809)
- **outbounds**: تمام پروکسی‌های آن کشور + DIRECT + BLOCK
- **routing**: balancer leastLoad با fallback
- **burstObservatory**: پینگ هر 3 دقیقه
- **policy**: timeout settings

## پشتیبانی پروتکل‌ها
- VLESS (TCP, WS, gRPC, KCP)
- VMess
- Trojan
- Shadowsocks

## امنیت
- CORS headers مناسب
- Rate limiting (در production)
- SSL/TLS اجباری
- Input validation

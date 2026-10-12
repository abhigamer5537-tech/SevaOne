# SevaOne + Razorpay (वेबसाइट और Android APK starter)

इस पैकेज में मौजूदा SevaOne HTML की कॉपी और Razorpay के लिए Express/PostgreSQL बैकएंड है। मौजूदा Home, Services, Orders, Training, My Account, Admin UI और स्थानीय डेमो डेटा को रखा गया है। सेवा चुनने पर नया flow सर्वर पर order बनाता है, Razorpay Checkout खोलता है और server-side signature + Razorpay payment details जाँच के बाद ही भुगतान सफल बताता है।

## अभी क्या पूरा है / क्या बाकी है
- Razorpay order creation, signature verification और webhook endpoint का source शामिल है।
- मूल्य backend catalog में server-side रखे गए हैं; HTML/localStorage से भेजे गए मूल्य को भरोसेमंद नहीं माना जाता। यदि admin rate बदले, तो `server/index.js` के `catalog` में वही दर भी बदलें।
- पुराना registration/login और ग्राहक/admin data अभी demo/localStorage है। यह साझा, सुरक्षित production login नहीं है; अलग-अलग डिवाइस के बीच profile/orders sync नहीं होंगे। इस starter को वास्तविक ग्राहकों के लिए चालू करने से पहले auth/admin APIs, role-based authorization, customer order history API, backups, privacy policy और support/refund process जोड़ना/जाँचना जरूरी है।
- Referral/cashback और manual admin controls demo/localStorage ही हैं; वास्तविक भुगतान/कैशबैक न मानें।
- APK यहाँ compile नहीं हुआ है। Android project generate करने और Android Studio/SDK से build करने के steps नीचे हैं।

## 1. Razorpay अकाउंट
1. Razorpay पर account/KYC पूरा करें.
2. पहले Test Mode keys इस्तेमाल करें.
3. Live Mode तभी करें जब business/account approved हो और test payments verify हो चुके हों.
4. Secret key को कभी HTML, APK, Git repository या ChatGPT में न डालें. केवल server environment variables में रखें.
5. Dashboard में webhook URL `https://YOUR-DOMAIN/api/payments/webhook` बनाएँ; event `payment.captured` (और चाहें तो `order.paid`) चुनें. Webhook secret `.env` में उसी के अनुसार रखें.

## 2. Backend setup
Node.js 20+ और PostgreSQL की जरूरत है.

```bash
npm install
cp .env.example .env
# .env में DATABASE_URL और Razorpay TEST keys भरें
npm start
```

Health check: `https://YOUR-DOMAIN/api/health`

Local development में वेबसाइट `http://localhost:3000` पर खुलेगी. Production में HTTPS जरूरी है. `.env` को सार्वजनिक न करें.

## 3. Website deploy
पूरे folder को Node.js host (जैसे Render/Railway/Fly.io या अपने VPS) पर deploy करें, साथ में managed PostgreSQL जोड़ें. Host dashboard में `.env.example` वाले environment variables सेट करें. HTTPS domain मिलने के बाद Razorpay webhook URL अपडेट करें. लाइव करने से पहले Test Mode में सफल, असफल, cancel, duplicate callback और webhook flows जाँचें.

## 4. Android APK
APK बनाने के लिए कंप्यूटर पर Node.js, Android Studio और Android SDK चाहिए.

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Android Studio में Build > Generate Signed Bundle / APK चुनें. यदि app को उसी live data/backend का इस्तेमाल करना है, तो HTTPS पर deployed website की URL के साथ Capacitor server URL configure करें और फिर `npx cap sync android` करें. Local bundled HTML से API call करने के लिए `public/sevaone-config.js` में `API_BASE` को आपके HTTPS backend domain पर सेट करना होगा. यह domain मिलने के बाद ही सेट करें. किसी भी स्थिति में Razorpay secret APK में नहीं जाता.

## 5. महत्वपूर्ण सुरक्षा नोट
यह एक integration starter है, audited production system नहीं. Login/registration अभी browser localStorage में है और वास्तविक SMS OTP लागू नहीं है. Public launch से पहले authentication, admin authorization, rate limits/abuse monitoring, privacy/legal requirements और order history sync लागू करें. कभी भी frontend callback अकेले देखकर order paid न करें; server verification/webhook ही payment source of truth होना चाहिए.

## 6. मोबाइल से GitHub Actions द्वारा टेस्ट APK
इस प्रोजेक्ट में `.github/workflows/build-android-apk.yml` जोड़ा गया है। बिना Android Studio के GitHub Actions से debug APK बनाने के लिए `BUILD_APK_ON_MOBILE_HI.md` पढ़ें। यह workflow APK को build run के **Artifacts** में देता है; APK पहले से ZIP में नहीं है।

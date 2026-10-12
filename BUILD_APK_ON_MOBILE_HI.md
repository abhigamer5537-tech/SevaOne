# SevaOne का Android APK बनाना (कंप्यूटर के बिना)

इस प्रोजेक्ट में GitHub Actions workflow जोड़ा गया है। इससे GitHub पर APK build करवा सकते हैं; APK अपने-आप इस ZIP में शामिल नहीं है।

## मोबाइल से APK बनाने के चरण
1. GitHub पर लॉगिन करें या अकाउंट बनाएँ।
2. इस ZIP को extract करें और अंदर का `SevaOne-Razorpay` folder अपने GitHub repository में upload करें। `package.json`, `public/`, `server/`, `.github/` आदि repository के root में होने चाहिए—अतिरिक्त nested folder नहीं।
3. Repository में **Actions** tab खोलें। पहली बार workflow चलाने की अनुमति माँगे तो enable करें।
4. **Build SevaOne Android APK** workflow चुनें और **Run workflow** दबाएँ।
5. Build सफल होने पर workflow run खोलें; नीचे **Artifacts** में `SevaOne-debug-APK` डाउनलोड करें। ZIP को extract करके `app-debug.apk` Android फोन पर खोलें। Android आपसे “Install unknown apps” की अनुमति माँग सकता है। APK केवल तभी install करें जब आपने अपना repository/build पहचाना हो।

## ध्यान देने योग्य बातें
- यह **debug/test APK** है, Play Store या public production release के लिए signed release build नहीं।
- इस workflow से बने APK में web app का bundled HTML चलेगा। असली shared customer accounts और payments के लिए HTTPS पर deployed backend चाहिए। `public/sevaone-config.js` में `API_BASE` को अपने backend domain से सेट करना होगा।
- `server/.env` या Razorpay secret key कभी repository में upload न करें। केवल backend hosting provider के secret/environment settings में रखें।
- मौजूदा login/profile के कुछ हिस्से अभी demo/localStorage हैं; इसे production-ready secure account system न समझें।
- GitHub repository public रखने पर source code सबको दिख सकता है; निजी रखना चाहें तो private repository बनाएँ।

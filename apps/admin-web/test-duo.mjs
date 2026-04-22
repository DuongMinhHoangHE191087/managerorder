const ANDROID_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Duodroid/5.152.1 Dalvik/2.1.0 (Linux; U; Android 13)",
  "Accept": "application/json",
};

const IOS_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "DuolingoMobile/7.4.2 (iPhone; iOS 16.4.1; Scale/3.00)",
  "Accept": "application/json",
};

const URLS = [
  { url: "https://android-api-cf.duolingo.com/2017-06-30/login?fields=id", headers: ANDROID_HEADERS, name: "Android CF" },
  { url: "https://ios-api-cf.duolingo.com/2017-06-30/login?fields=id", headers: IOS_HEADERS, name: "iOS CF" },
  { url: "https://android-api.duolingo.com/2017-06-30/login?fields=id", headers: ANDROID_HEADERS, name: "Android No-CF" },
  { url: "https://www.duolingo.com/2017-06-30/login?fields=id", headers: ANDROID_HEADERS, name: "Web API" }
];

async function test() {
  for (const t of URLS) {
    console.log(`Testing ${t.name}...`);
    try {
      const loginRes = await fetch(t.url, {
        method: "POST",
        headers: t.headers,
        body: JSON.stringify({
          distinctId: "12345678-1234-1234-1234-123456789012",
          identifier: "test@example.com",
          password: "testpassword",
        }),
      });
      console.log(`-> Status: ${loginRes.status}`);
      const text = await loginRes.text();
      console.log(`-> Response: ${text.substring(0, 100)}`);
    } catch (e) {
      console.log(`-> Error: ${e.message}`);
    }
  }
}

test();

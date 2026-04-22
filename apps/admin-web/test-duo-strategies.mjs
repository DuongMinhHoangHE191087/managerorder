/**
 * Test 3 chiến lược lấy Duolingo ID để tìm cách nào hoạt động từ cloud server.
 * Chạy: node test-duo-strategies.mjs
 */

const USERNAME = 'thachtncam';

const CHROME_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

const FULL_BROWSER_HEADERS = {
  ...CHROME_HEADERS,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Chromium";v="131", "Not A(Brand";v="99", "Google Chrome";v="131"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ─── Strategy 1: API direct ───
async function strategy1_API() {
  console.log('\n═══ STRATEGY 1: Duolingo API ?fields=users,id&username= ═══');
  try {
    const url = `https://www.duolingo.com/2017-06-30/users?fields=users,id&username=${USERNAME}`;
    const res = await fetch(url, { headers: CHROME_HEADERS, signal: AbortSignal.timeout(10000) });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const user = data.users?.[0];
      console.log(`✅ ID: ${user?.id}, Username: ${user?.username}`);
      return user?.id;
    }
    console.log(`❌ Body: ${(await res.text()).substring(0, 200)}`);
  } catch (e) { console.log(`❌ Error: ${e.message}`); }
  return null;
}

// ─── Strategy 2: Scrape profile page HTML ───
async function strategy2_ProfileScrape() {
  console.log('\n═══ STRATEGY 2: Scrape profile page HTML ═══');
  try {
    const url = `https://www.duolingo.com/profile/${USERNAME}`;
    const res = await fetch(url, { headers: FULL_BROWSER_HEADERS, signal: AbortSignal.timeout(10000) });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      console.log(`HTML length: ${html.length}`);
      
      // Method A: __NEXT_DATA__
      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (nextMatch) {
        try {
          const nd = JSON.parse(nextMatch[1]);
          // Try multiple paths
          const user = nd?.props?.pageProps?.initialData?.user 
            || nd?.props?.pageProps?.user
            || nd?.props?.pageProps?.initialData?.profile;
          if (user?.id) {
            console.log(`✅ __NEXT_DATA__ → ID: ${user.id}, Username: ${user.username}`);
            return user.id;
          }
          console.log(`pageProps keys: ${Object.keys(nd?.props?.pageProps || {}).join(', ')}`);
        } catch { console.log('Failed to parse __NEXT_DATA__'); }
      }
      
      // Method B: Regex fallback in all script tags
      const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
      for (const script of allScripts) {
        const idMatch = script.match(/"id"\s*:\s*(\d{6,})/);
        if (idMatch) {
          console.log(`✅ Regex in script → ID: ${idMatch[1]}`);
          return parseInt(idMatch[1]);
        }
      }

      // Method C: Look for user data in any JSON-like structure
      const globalIdMatch = html.match(/"userId"\s*:\s*(\d+)/) || html.match(/"user_id"\s*:\s*(\d+)/);
      if (globalIdMatch) {
        console.log(`✅ Global regex → ID: ${globalIdMatch[1]}`);
        return parseInt(globalIdMatch[1]);
      }
      
      // Method D: Look in meta tags or data attributes
      const metaMatch = html.match(/data-userid="(\d+)"/) || html.match(/content="(\d{6,})"/);
      if (metaMatch) {
        console.log(`✅ Meta/data attr → ID: ${metaMatch[1]}`);
        return parseInt(metaMatch[1]);
      }

      console.log(`❌ No ID found in HTML`);
      console.log(`First 1000 chars: ${html.substring(0, 1000)}`);
    }
  } catch (e) { console.log(`❌ Error: ${e.message}`); }
  return null;
}

// ─── Strategy 3: duome.eu ───
async function strategy3_Duome() {
  console.log('\n═══ STRATEGY 3: duome.eu scrape ═══');
  try {
    const url = `https://duome.eu/${USERNAME}`;
    const res = await fetch(url, { 
      headers: { ...CHROME_HEADERS, Accept: 'text/html' }, 
      signal: AbortSignal.timeout(10000) 
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      console.log(`HTML length: ${html.length}`);
      
      // duome.eu typically has user ID in various places
      const patterns = [
        /data-id="(\d+)"/,
        /"userId"\s*:\s*(\d+)/,
        /user_id[=:]\s*['"]?(\d+)/i,
        /duolingo\.com\/2017-06-30\/users\/(\d+)/,
        /simg-ssl\.duolingo\.com\/[^"]*\/(\d+)\//,
        /\/avatars\/(\d+)\//,
      ];
      
      for (const pattern of patterns) {
        const m = html.match(pattern);
        if (m) {
          console.log(`✅ Pattern ${pattern.source} → ID: ${m[1]}`);
          return parseInt(m[1]);
        }
      }
      
      // Dump relevant snippets
      const avatarMatch = html.match(/simg-ssl[^"]{0,200}/);
      if (avatarMatch) console.log(`Avatar snippet: ${avatarMatch[0]}`);
      
      const idSnippets = html.match(/\d{8,}/g);
      if (idSnippets) console.log(`Long numbers found: ${[...new Set(idSnippets)].slice(0, 5).join(', ')}`);
      
      console.log(`❌ No ID found via patterns`);
    }
  } catch (e) { console.log(`❌ Error: ${e.message}`); }
  return null;
}

// ─── Strategy 4: duome.eu JSON API ───
async function strategy4_DuomeJSON() {
  console.log('\n═══ STRATEGY 4: duome.eu JSON endpoint ═══');
  try {
    const url = `https://duome.eu/${USERNAME}/info`;
    const res = await fetch(url, { headers: CHROME_HEADERS, signal: AbortSignal.timeout(10000) });
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Body (first 500): ${text.substring(0, 500)}`);
  } catch (e) { console.log(`❌ Error: ${e.message}`); }
}

(async () => {
  const r1 = await strategy1_API();
  const r2 = await strategy2_ProfileScrape();
  const r3 = await strategy3_Duome();
  await strategy4_DuomeJSON();
  
  console.log('\n═══ SUMMARY ═══');
  console.log(`Strategy 1 (API):     ${r1 ?? '❌ FAILED'}`);
  console.log(`Strategy 2 (Scrape):  ${r2 ?? '❌ FAILED'}`);
  console.log(`Strategy 3 (duome):   ${r3 ?? '❌ FAILED'}`);
})();

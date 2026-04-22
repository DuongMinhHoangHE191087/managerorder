// Test multiple approaches to get Duolingo user ID from username

const USERNAME = 'thachtncam';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function testMethod1_ProfileScrape() {
  console.log('\n=== METHOD 1: Scrape profile page for __NEXT_DATA__ ===');
  try {
    const res = await fetch(`https://www.duolingo.com/profile/${USERNAME}`, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
    });
    console.log('Status:', res.status);
    if (!res.ok) { console.log('FAILED'); return; }
    const html = await res.text();
    // Find __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (nextDataMatch) {
      const data = JSON.parse(nextDataMatch[1]);
      const user = data?.props?.pageProps?.initialData?.user || data?.props?.pageProps?.user;
      console.log('User from __NEXT_DATA__:', user ? { id: user.id, username: user.username, name: user.name } : 'NOT FOUND');
      // Also try deeper paths
      console.log('Keys in pageProps:', Object.keys(data?.props?.pageProps || {}));
    } else {
      // Fallback: look for user ID in meta tags or other script content
      const idMatch = html.match(/"userId":(\d+)/);
      const idMatch2 = html.match(/"id":(\d+)/);
      console.log('userId via regex:', idMatch?.[1] || 'NOT FOUND');
      console.log('id via regex:', idMatch2?.[1] || 'NOT FOUND');
      console.log('HTML snippet (first 500 chars):', html.substring(0, 500));
    }
  } catch (e) { console.error('Error:', e.message); }
}

async function testMethod2_API_FullHeaders() {
  console.log('\n=== METHOD 2: API /2017-06-30/users?username= with FULL browser headers ===');
  try {
    const res = await fetch(`https://www.duolingo.com/2017-06-30/users?username=${USERNAME}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Chromium";v="131", "Not A(Brand";v="99", "Google Chrome";v="131"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        Referer: 'https://www.duolingo.com/learn',
        Origin: 'https://www.duolingo.com',
      },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 300));
  } catch (e) { console.error('Error:', e.message); }
}

async function testMethod3_API_MinimalJSON() {
  console.log('\n=== METHOD 3: API /2017-06-30/users?username= with minimal Accept:json ===');
  try {
    const res = await fetch(`https://www.duolingo.com/2017-06-30/users?username=${USERNAME}`, {
      headers: { ...BROWSER_HEADERS, Accept: 'application/json' },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 300));
  } catch (e) { console.error('Error:', e.message); }
}

async function testMethod4_API_FieldsParam() {
  console.log('\n=== METHOD 4: API with explicit fields param ===');
  try {
    const fields = 'users{id,username,name,hasPlus,streak,totalXp,gems,learningLanguage,creationDate,courses{title,learningLanguage,xp},picture}';
    const res = await fetch(`https://www.duolingo.com/2017-06-30/users?fields=${encodeURIComponent(fields)}&username=${USERNAME}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
        Referer: 'https://www.duolingo.com/',
        Origin: 'https://www.duolingo.com',
      },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 500));
  } catch (e) { console.error('Error:', e.message); }
}

async function testMethod5_Duome() {
  console.log('\n=== METHOD 5: duome.eu/USERNAME (third-party) ===');
  try {
    const res = await fetch(`https://duome.eu/${USERNAME}`, {
      headers: { ...BROWSER_HEADERS, Accept: 'text/html' },
    });
    console.log('Status:', res.status);
    if (res.ok) {
      const html = await res.text();
      const idMatch = html.match(/duolingo\.com\/profile\/.*?".*?(\d{10,})/s);
      const idMatch2 = html.match(/user_id[^\d]*?(\d+)/i);
      console.log('ID from duome regex 1:', idMatch?.[1] || 'NOT FOUND');
      console.log('ID from duome regex 2:', idMatch2?.[1] || 'NOT FOUND');
    }
  } catch (e) { console.error('Error:', e.message); }
}

(async () => {
  await testMethod1_ProfileScrape();
  await testMethod2_API_FullHeaders();
  await testMethod3_API_MinimalJSON();
  await testMethod4_API_FieldsParam();
  await testMethod5_Duome();
  console.log('\n=== DONE ===');
})();

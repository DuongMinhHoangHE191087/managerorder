import fs from 'fs';

const USERNAME = 'thachtncam';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function testMethod4_API() {
  console.log('\n=== METHOD 4: API with explicit fields param ===');
  try {
    const res = await fetch(`https://www.duolingo.com/2017-06-30/users?username=${USERNAME}`, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
      },
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body length:', text.length);
    fs.writeFileSync('test-duo-body.json', text);
    console.log('Wrote body to test-duo-body.json');
  } catch (e) { console.error('Error:', e.message); }
}

(async () => {
  await testMethod4_API();
})();

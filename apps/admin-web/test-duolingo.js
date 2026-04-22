const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'Referer': 'https://www.duolingo.com/learn',
  'Origin': 'https://www.duolingo.com',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjYzMDcyMDAwMDAsImlhdCI6MCwic3ViIjo5NDgyMjQ0MTA3NjY5NX0.1O_MEaq5sMDCichFCYqMsUfQxCupieWdwC2-SWBssao',
  'Cookie': 'jwt_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjYzMDcyMDAwMDAsImlhdCI6MCwic3ViIjo5NDgyMjQ0MTA3NjY5NX0.1O_MEaq5sMDCichFCYqMsUfQxCupieWdwC2-SWBssao;'
};

async function test() {
  console.log("Testing /users?username=ThachTnCam");
  try {
    let res = await fetch('https://www.duolingo.com/2017-06-30/users?username=ThachTnCam', { headers });
    console.log('STATUS:', res.status);
    console.log('BODY:', (await res.text()).slice(0, 500));
  } catch (e) {
    console.error(e);
  }

  console.log("\\nTesting /users/94822441076695");
  try {
    let res = await fetch('https://www.duolingo.com/2017-06-30/users/94822441076695', { headers });
    console.log('STATUS:', res.status);
    console.log('BODY:', (await res.text()).slice(0, 500));
  } catch (e) {
    console.error(e);
  }
}
test();

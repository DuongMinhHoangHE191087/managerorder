const token = '8626655358:AAE-IW_4XBbBClSdXRsdjvHm2nAUO0Cw12M';
const setCommands = async () => {
  const r1 = await fetch('https://api.telegram.org/bot' + token + '/setMyCommands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        {command: 'start', description: 'Bắt đầu sử dụng bot & Nhận hướng dẫn'},
        {command: 'help', description: 'Xem danh sách các lệnh hỗ trợ'},
        {command: 'connect', description: 'Liên kết tài khoản ứng dụng với Telegram'},
        {command: 'profile', description: 'Xem thông tin tài khoản đã liên kết'},
        {command: 'unlink', description: 'Hủy liên kết tài khoản'}
      ]
    })
  });
  console.log('Commands:', await r1.json());
  
  const r2 = await fetch('https://api.telegram.org/bot' + token + '/setChatMenuButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Mở Mini App',
        web_app: { url: 'https://duongminhhoang.id.vn' }
      }
    })
  });
  console.log('Menu Button:', await r2.json());
};
setCommands();

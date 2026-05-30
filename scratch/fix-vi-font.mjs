import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Khôi phục lại file vi.ts gốc từ git
try {
  execSync('git checkout -- apps/admin-web/src/shared/messages/vi.ts');
  console.log("Đã khôi phục lại file vi.ts gốc!");
} catch (e) {
  console.error("Không thể checkout vi.ts:", e.message);
}

const filePath = 'd:/DMHoang/Project_GitHub/managerorder/apps/admin-web/src/shared/messages/vi.ts';
const content = fs.readFileSync(filePath, 'utf8');

const win1252ToByte = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201C: 0x93, // “
  0x201D: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F  // Ÿ
};

function decodeMojibake(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 255) {
      bytes.push(code);
    } else if (win1252ToByte[code] !== undefined) {
      bytes.push(win1252ToByte[code]);
    } else {
      throw new Error(`Ký tự ngoài Windows-1252: ${str[i]} (${code})`);
    }
  }
  const buf = Buffer.from(bytes);
  return buf.toString('utf8');
}

const stringRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

let count = 0;
const fixedContent = content.replace(stringRegex, (match, doubleQuote, singleQuote, backtick) => {
  const quote = match[0];
  const str = doubleQuote !== undefined ? doubleQuote : (singleQuote !== undefined ? singleQuote : backtick);
  
  // Kiểm tra xem chuỗi có thể chứa ký tự Mojibake không
  const hasMojibakeChars = /[ÃÄåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(str) || 
                           str.includes('‘') || str.includes('’') || str.includes('“') || 
                           str.includes('”') || str.includes('•') || str.includes('–') || 
                           str.includes('—') || str.includes('™') || str.includes('œ');
  
  if (!hasMojibakeChars) {
    return match;
  }
  
  try {
    const decoded = decodeMojibake(str);
    
    // NẾU CHUỖI SAU KHI DECODE CHỨA KÝ TỰ LỖI U+FFFD
    // THÌ CHẮC CHẮN ĐÂY LÀ CHUỖI ĐÃ ĐÚNG BỊ DECODE SAI -> HỦY BỎ!
    if (decoded.includes('\uFFFD')) {
      return match;
    }
    
    count++;
    const escaped = decoded
      .replace(/\\/g, '\\\\')
      .replace(new RegExp(quote, 'g'), '\\' + quote)
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    return quote + escaped + quote;
  } catch (e) {
    return match;
  }
});

fs.writeFileSync(filePath, fixedContent, 'utf8');
console.log(`Đã sửa xong! Tổng số chuỗi thực tế đã khôi phục: ${count}`);

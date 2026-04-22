// ============================================
// EXCEL IMPORT PARSER UTILITIES
// ============================================
// All functions related to reading, detecting headers,
// fuzzy-matching columns, and extracting typed data
// from raw Excel worksheets.

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

export type FieldGroup = 'core' | 'customer' | 'contact' | 'payment' | 'duolingo' | 'other';

export type TargetField = {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
  aliases: string[]; // Keywords for fuzzy matching
  group: FieldGroup;
  /** If set, this field represents a contact channel */
  contactChannel?: ContactChannelKey;
};

// --- Contact channel system ---
export type ContactChannelKey = 'phone' | 'email' | 'zalo' | 'facebook' | 'telegram' | 'skype' | 'other';

export interface ContactChannelOption {
  key: ContactChannelKey;
  label: string;
  icon: string;
  color: string;
  placeholder: string;
}

export const CONTACT_CHANNEL_OPTIONS: ContactChannelOption[] = [
  { key: 'phone', label: 'Số Điện Thoại', icon: '📱', color: '#22c55e', placeholder: '0901234567' },
  { key: 'email', label: 'Email', icon: '📧', color: '#3b82f6', placeholder: 'example@gmail.com' },
  { key: 'zalo', label: 'Zalo', icon: '💬', color: '#0068ff', placeholder: 'SĐT hoặc Zalo ID' },
  { key: 'facebook', label: 'Facebook', icon: '👤', color: '#1877f2', placeholder: 'facebook.com/username' },
  { key: 'telegram', label: 'Telegram', icon: '✈️', color: '#229ed9', placeholder: '@username' },
  { key: 'skype', label: 'Skype', icon: '💻', color: '#00aff0', placeholder: 'live:username' },
  { key: 'other', label: 'Khác', icon: '📋', color: '#6b7280', placeholder: 'Thông tin liên hệ' },
];

export type ContactEntry = {
  channel: ContactChannelKey;
  value: string;
};

export const FIELD_GROUP_META: Record<FieldGroup, { label: string; icon: string }> = {
  core: { label: 'Trường Bắt Buộc', icon: '⭐' },
  customer: { label: 'Khách Hàng', icon: '👤' },
  contact: { label: 'Phương Thức Liên Lạc', icon: '📞' },
  payment: { label: 'Thanh Toán & Sản Phẩm', icon: '💰' },
  duolingo: { label: 'Duolingo / Account', icon: '🦉' },
  other: { label: 'Thông tin Khác', icon: '📋' },
};

export const ORDER_IMPORT_FIELDS: TargetField[] = [
  // --- Core (always visible) ---
  { key: 'customerName', label: 'Tên Khách Hàng', required: true, type: 'string', group: 'core', aliases: ['khách hàng', 'tên', 'name', 'customer', 'người mua', 'tên khách', 'họ tên', 'tên kh'] },
  { key: 'productName', label: 'Tên Sản Phẩm', required: true, type: 'string', group: 'core', aliases: ['sản phẩm', 'gói', 'subcription', 'subscription', 'product', 'mặt hàng', 'loại gói', 'tên gói', 'goi', 'gói mua', 'gói đăng ký'] },
  // --- Customer info ---
  { key: 'orderCode', label: 'Mã Đơn Hàng', required: false, type: 'string', group: 'customer', aliases: ['mã đơn', 'mã đơn hàng', 'order code', 'order id', 'mã', 'ma don', 'ma don hang', 'order no', 'stt', 'mã số'] },
  { key: 'customerCode', label: 'Mã Khách Hàng', required: false, type: 'string', group: 'customer', aliases: ['mã khách hàng', 'mã kh', 'customer code', 'customer id', 'ma kh', 'ma khach hang'] },
  { key: 'ctvName', label: 'CTV / Đại lý', required: false, type: 'string', group: 'customer', aliases: ['ctv', 'cộng tác viên', 'agent', 'đại lý', 'seller', 'dai ly', 'nguoi ban', 'người bán'] },
  // --- Contact channels ---
  { key: 'customerPhone', label: 'Số Điện Thoại', required: false, type: 'string', group: 'contact', contactChannel: 'phone', aliases: ['số điện thoại', 'điện thoại', 'phone', 'sdt', 'so dien thoai'] },
  { key: 'zaloContact', label: 'Zalo', required: false, type: 'string', group: 'contact', contactChannel: 'zalo', aliases: ['zalo', 'zl', 'zalo id'] },
  // --- Payment & Product (chỉ giữ: Tổng tiền, Trạng thái TT, Ngày bắt đầu, Ngày hết hạn) ---
  { key: 'totalAmountVnd', label: 'Tổng Tiền', required: false, type: 'number', group: 'payment', aliases: ['tổng tiền', 'thành tiền', 'price', 'số tiền', 'tiền', 'giá', 'gia ban', 'giá bán', 'giá tiền'] },
  { key: 'rawPaymentStatus', label: 'Trạng Thái Thanh Toán', required: false, type: 'string', group: 'payment', aliases: ['thanh toán', 'status payment', 'trạng thái đơn', 'trạng thái', 'payment status', 'trang thai', 'trạng thái thanh toán'] },
  { key: 'startDate', label: 'Ngày Bắt Đầu', required: false, type: 'date', group: 'payment', aliases: ['ngày mua', 'ngày bắt đầu', 'date', 'start', 'ngày đăng ký', 'ngay mua', 'ngày bắt đầu'] },
  { key: 'endDate', label: 'Ngày Hết Hạn', required: false, type: 'date', group: 'payment', aliases: ['ngày hết hạn', 'hạn family', 'expires', 'hết hạn', 'end date', 'han', 'ngay het han'] },
  // --- Duolingo group starts empty — all fields added via "+" button ---
  // --- Other ---
  { key: 'salesNote', label: 'Ghi Chú', required: false, type: 'string', group: 'other', aliases: ['ghi chú', 'note', 'thông tin thêm', 'note family', 'ghi chu'] },
];

/** All Duolingo fields — available via "+" button, can be added/removed dynamically */
export const DUOLINGO_EXTRA_FIELDS: TargetField[] = [
  { key: 'duolingoUsername', label: 'Username / ID', required: false, type: 'string', group: 'duolingo', aliases: ['username duolingo', 'username', 'tên đăng nhập', 'nick', 'duolingo user', 'id_username', 'user duo'] },
  { key: 'sourceUsername', label: 'Nick Family', required: false, type: 'string', group: 'duolingo', aliases: ['family username', 'nick family', 'source', 'family account', 'nick source'] },
  { key: 'inviteLink', label: 'Link Invite', required: false, type: 'string', group: 'duolingo', aliases: ['link join', 'link join family', 'invite', 'link gia đình', 'link invite', 'link join (family)'] },
  { key: 'idFamily', label: 'ID Family', required: false, type: 'string', group: 'duolingo', aliases: ['id family', 'family id', 'mã family', 'family code'] },
  { key: 'duolingoId', label: 'Duolingo ID (số)', required: false, type: 'string', group: 'duolingo', aliases: ['duolingo id', 'id duolingo', 'duo id'] },
  { key: 'facebookUrl', label: 'Facebook / Liên hệ', required: false, type: 'string', group: 'duolingo', aliases: ['ttll', 'facebook', 'link liên lạc', 'fb', 'link fb', 'plus', 'liên hệ', 'lien he', 'lien lac'] },
];

/** Default values that can be set for all records */
export interface ImportDefaultValues {
  quantity: number;
}

// ----------------------------------------------------------------------
// STRING UTILITIES (internal)
// ----------------------------------------------------------------------

/**
 * Safely convert any cell value to string.
 * Handles: Date objects, XLSX rich text ({t,v,r}), arrays, nested objects.
 * Prevents "[object Object]" from appearing in import data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeStringify(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(safeStringify).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    // XLSX rich text format: { t: 's', v: 'actual text', r: '<t>...</t>' }
    if ('v' in value && value.v !== undefined) return safeStringify(value.v);
    if ('w' in value && value.w !== undefined) return String(value.w).trim();
    if ('t' in value && typeof value.t === 'string') return value.t.trim();
    // Last resort: JSON stringify, but never return "[object Object]"
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

/**
 * Levenshtein distance between two strings for fuzzy matching
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Normalize string for comparison (remove accents, lowercase, keep alphanumeric)
 */
function normalizeString(str: string): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '');
}

// ----------------------------------------------------------------------
// HEADER DETECTION
// ----------------------------------------------------------------------

const HEADER_KEYWORDS = [
  'username', 'tên', 'name', 'ngày', 'date', 'giá', 'price', 'tiền', 'gói', 'mã',
  'hạn', 'trạng thái', 'status', 'thanh toán', 'payment', 'ctv', 'family', 'note'
];

/**
 * Auto-detect header row within first 20 rows using text-count + keyword scoring
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectHeaderRowIndex(data: any[][]): number {
  if (!data || data.length === 0) return 0;
  
  let bestIndex = 0;
  let bestScore = -1;
  
  const searchLimit = Math.min(data.length, 20);
  
  for (let i = 0; i < searchLimit; i++) {
    const row = data[i];
    if (!row) continue;
    
    const stringCells = row.filter(cell => cell && typeof cell === 'string' && cell.trim().length > 0);
    const stringCount = stringCells.length;
    if (stringCount === 0) continue;
    
    const keywordScore = stringCells.reduce((acc: number, cell: string) => {
      const norm = normalizeString(cell);
      const hasKeyword = HEADER_KEYWORDS.some(kw => norm.includes(normalizeString(kw)));
      return acc + (hasKeyword ? 2 : 0);
    }, 0);
    
    const score = stringCount + keywordScore;
    
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  
  return bestIndex;
}

// ----------------------------------------------------------------------
// FUZZY MATCHING
// ----------------------------------------------------------------------

/**
 * Match Excel headers to target fields using fuzzy string matching.
 * @param extraFields Optional extra fields (e.g. DUOLINGO_EXTRA_FIELDS) to also match against
 */
export function fuzzyMatchHeaders(
  headers: string[],
  extraFields?: TargetField[]
): Record<string, number> {
  const mapping: Record<string, number> = {};
  const normalizedHeaders = headers.map(h => normalizeString(h));
  const claimedIndices = new Set<number>();

  // Combine ORDER_IMPORT_FIELDS + any extra fields
  const allFields = extraFields
    ? [...ORDER_IMPORT_FIELDS, ...extraFields]
    : ORDER_IMPORT_FIELDS;

  allFields.forEach(field => {
    let bestMatchIndex = -1;
    let minDistance = Infinity;
    
    const fieldAliases = [...field.aliases, field.label, field.key]
      .map(normalizeString)
      .filter(a => a.length >= 3);

    normalizedHeaders.forEach((headerStr, hIndex) => {
      if (!headerStr || claimedIndices.has(hIndex)) return;
      
      fieldAliases.forEach(alias => {
        if (minDistance === -1) return;

        if (alias.length >= 3 && (headerStr.includes(alias) || alias.includes(headerStr))) {
          bestMatchIndex = hIndex;
          minDistance = -1;
          return;
        }

        const dist = levenshteinDistance(headerStr, alias);
        const threshold = alias.length <= 5 ? 2 : Math.floor(alias.length * 0.3);
        if (dist < minDistance && dist <= threshold) {
          minDistance = dist;
          bestMatchIndex = hIndex;
        }
      });
    });

    if (bestMatchIndex !== -1 && (minDistance === -1 || minDistance <= 4)) {
      mapping[field.key] = bestMatchIndex;
      claimedIndices.add(bestMatchIndex);
    }
  });

  return mapping;
}

// ----------------------------------------------------------------------
// DATE PARSING
// ----------------------------------------------------------------------

/**
 * Convert Excel Date Serial Number to ISO Date string
 */
export function excelDateToJSDateString(excelSerial: number): string | undefined {
  if (!excelSerial || isNaN(excelSerial)) return undefined;
  const unixEpoch = Math.round((excelSerial - 25569) * 86400 * 1000);
  if (unixEpoch < 1262304000000 || unixEpoch > 2524608000000) return undefined;
  return new Date(unixEpoch).toISOString();
}

/**
 * Parse Vietnamese date format "DD/MM/YYYY" to ISO string
 */
export function parseVietnameseDateStr(str: string): string | undefined {
  if (!str || typeof str !== 'string') return undefined;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/**
 * Parse an Excel date cell: handles both Serial Number and DD/MM/YYYY string
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseExcelDate(cellValue: any): string | undefined {
  if (!cellValue) return undefined;
  if (typeof cellValue === 'number') return excelDateToJSDateString(cellValue);
  if (typeof cellValue === 'string') return parseVietnameseDateStr(cellValue) || undefined;
  return undefined;
}

// ----------------------------------------------------------------------
// DOMAIN PARSERS (Duolingo, Facebook, Payment status)
// ----------------------------------------------------------------------

/**
 * Parse mixed Duolingo string, e.g. "Username: SnDng451816 ID: 1270083294"
 */
export function parseDuolingoField(str: string): { username: string; duolingoId: string } {
  if (!str || typeof str !== 'string') return { username: '', duolingoId: '' };
  const usernameMatch = str.match(/Username:\s*([^\s]+)/i);
  const idMatch = str.match(/ID:\s*(\d+)/i);
  const username = usernameMatch ? usernameMatch[1].trim() : str.trim();
  const duolingoId = idMatch ? idMatch[1].trim() : '';
  return { username, duolingoId };
}

/**
 * Detect and extract Facebook URL from a string
 */
export function parseFacebookUrl(str: string): { isFbUrl: boolean; url: string } {
  if (!str || typeof str !== 'string') return { isFbUrl: false, url: '' };
  const trimmed = str.trim();
  const isFbUrl = /https?:\/\/(www\.)?facebook\.com\//i.test(trimmed);
  return { isFbUrl, url: trimmed };
}

/**
 * Normalize plan name to slug for DB fuzzy matching
 */
export function normalizePlanName(str: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Map payment status text from Excel to system status enum
 */
export function normalizePaymentStatus(
  str: string | undefined | null
): 'paid' | 'refunded' | 'expired' | 'pending_payment' | 'draft' {
  if (!str) return 'draft';
  const s = str.trim().toLowerCase();
  if (s.includes('đã thanh toán') || s.includes('paid') || s.includes('da thanh toan')) return 'paid';
  if (s.includes('không gia hạn') || s.includes('hết hạn') || s.includes('da kick') || s.includes('đã kick')) return 'expired';
  if (s.includes('cancel') || s.includes('hủy') || s.includes('hoàn') || s.includes('refund')) return 'refunded';
  if (s.includes('chờ') || s.includes('pending') || s.includes('đang chờ')) return 'pending_payment';
  return 'draft';
}

/**
 * Extract best display name for a customer:
 * If string is Facebook URL → return undefined (use duolingo username as fallback)
 */
export function smartExtractCustomerName(str: string): string | undefined {
  if (!str) return undefined;
  const { isFbUrl } = parseFacebookUrl(str);
  if (isFbUrl) return undefined;
  return str.trim();
}

// ----------------------------------------------------------------------
// DATA EXTRACTION
// ----------------------------------------------------------------------

/**
 * Extract raw array data into typed objects based on column mapping
 * Handles Duolingo-specific transforms: Facebook URL, Username+ID, date serial, payment status
 */
 
export function extractMappedData(
  rawData: any[][], // eslint-disable-line @typescript-eslint/no-explicit-any
  headerIndex: number,
  mapping: Record<string, number | undefined>,
  defaultValues?: ImportDefaultValues,
  allFields?: TargetField[]
) {
  const dataRows = rawData.slice(headerIndex + 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsedData: any[] = [];
  const fieldsToProcess = allFields || ORDER_IMPORT_FIELDS;
  
  dataRows.forEach((row, rowIndex) => {
    if (!row || row.length === 0 || row.every(cell => !cell)) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedItem: Record<string, any> = {};
    
    fieldsToProcess.forEach(field => {
      const colIndex = mapping[field.key];
      let cellValue = colIndex !== undefined ? row[colIndex] : undefined;
      
      if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
        if (field.type === 'string') {
          cellValue = safeStringify(cellValue);
        } else if (field.type === 'number') {
           if (typeof cellValue === 'string') {
               const numStr = cellValue.replace(/[^0-9.-]/g, '');
               cellValue = numStr ? Number(numStr) : 0;
           } else if (typeof cellValue === 'object') {
               const str = safeStringify(cellValue).replace(/[^0-9.-]/g, '');
               cellValue = str ? Number(str) : 0;
           } else {
               cellValue = Number(cellValue);
           }
        } else if (field.type === 'date') {
          cellValue = parseExcelDate(cellValue) || undefined;
        }
      } else {
        // Smart defaults — use provided defaults or fallback
        if (field.type === 'number') {
          if (field.key === 'quantity') {
            cellValue = defaultValues?.quantity ?? 1;
          } else {
            cellValue = 0;
          }
        }
        if (field.key === 'paymentMethod') cellValue = 'Chuyển khoản';
      }

      parsedItem[field.key] = cellValue;
    });

    // --- Post-processing: Duolingo-specific transforms ---

    if (parsedItem.duolingoUsername && typeof parsedItem.duolingoUsername === 'string') {
      const parsed = parseDuolingoField(parsedItem.duolingoUsername);
      if (parsed.username) parsedItem.duolingoUsername = parsed.username;
      if (parsed.duolingoId && !parsedItem.duolingoId) parsedItem.duolingoId = parsed.duolingoId;
    }

    // Facebook URL detection: extract and move to salesNote
    if (parsedItem.facebookUrl && typeof parsedItem.facebookUrl === 'string') {
      const { isFbUrl } = parseFacebookUrl(parsedItem.facebookUrl);
      if (isFbUrl || parsedItem.facebookUrl.includes('facebook.com')) {
        const fbNote = `FB: ${parsedItem.facebookUrl}`;
        parsedItem.salesNote = parsedItem.salesNote
          ? `${parsedItem.salesNote} | ${fbNote}`
          : fbNote;
      }
    }

    if (parsedItem.customerName) {
      const extracted = smartExtractCustomerName(parsedItem.customerName);
      if (!extracted) {
        if (!parsedItem.facebookUrl) parsedItem.facebookUrl = parsedItem.customerName;
        parsedItem.customerName = parsedItem.duolingoUsername || parsedItem.customerName;
      }
    }

    if (parsedItem.rawPaymentStatus) {
      parsedItem.normalizedStatus = normalizePaymentStatus(parsedItem.rawPaymentStatus);
    }

    // --- Build contactChannels array from all contact-type fields ---
    const contactChannels: ContactEntry[] = [];
    fieldsToProcess.filter(f => f.contactChannel).forEach(f => {
      const val = parsedItem[f.key];
      if (val && String(val).trim()) {
        contactChannels.push({ channel: f.contactChannel!, value: String(val).trim() });
      }
    });
    // Also check facebookUrl from duolingo group as facebook contact
    if (parsedItem.facebookUrl && String(parsedItem.facebookUrl).trim()) {
      const fbVal = String(parsedItem.facebookUrl).trim();
      if (!contactChannels.some(c => c.channel === 'facebook' && c.value === fbVal)) {
        contactChannels.push({ channel: 'facebook', value: fbVal });
      }
    }
    parsedItem._contactChannels = contactChannels;

    // --- CTV / Retail classification ---
    const ctvValue = parsedItem.ctvName ? String(parsedItem.ctvName).trim() : '';
    const isRetailLabel = ['khách lẻ', 'khach le', 'retail'].some(kw => ctvValue.toLowerCase().includes(kw));
    const hasCTV = !!(ctvValue && !isRetailLabel);
    parsedItem._orderType = hasCTV ? 'ctv' : 'retail';

    // --- Customer code logic: if CTV → use CTV name, if retail → use customerCode ---
    if (hasCTV) {
      parsedItem._resolvedCustomerCode = ctvValue;
    } else {
      parsedItem._resolvedCustomerCode = parsedItem.customerCode || '';
    }

    // --- Smart contact method detection ---
    // If any contact value contains facebook.com → Facebook, else → Zalo
    const hasFbContact = contactChannels.some(c =>
      c.value.toLowerCase().includes('facebook.com') || c.channel === 'facebook'
    );
    parsedItem._contactMethod = hasFbContact ? 'Facebook' : 'Zalo';

    // CTV orders: enrich salesNote
    if (hasCTV) {
      const ctvNote = `Đơn CTV: ${ctvValue}`;
      parsedItem.salesNote = parsedItem.salesNote
        ? `${parsedItem.salesNote} | ${ctvNote}`
        : ctvNote;
    }

    // --- Validate required fields after post-processing ---
    let error = '';
    if (!parsedItem.customerName || String(parsedItem.customerName).trim() === '') {
      error += 'Thiếu Tên Khách Hàng. ';
    }
    if (!parsedItem.productName || String(parsedItem.productName).trim() === '') {
      error += 'Thiếu Tên Sản Phẩm. ';
    }

    parsedData.push({
      ...parsedItem,
      _originalRowIndex: rowIndex + headerIndex + 2,
      _error: error ? `Dòng ${rowIndex + headerIndex + 2}: ${error.trim()}` : undefined
    });
  });

  return parsedData;
}

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export formatters for backward compatibility
// New code should import from '@/lib/utils/formatters' directly.
export {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateShort,
  formatDateCustom,
  formatDateKey,
  addDaysToDateKey,
  formatDateLabel,
  formatRelativeTime,
} from './utils/formatters'

// Re-export Excel utilities for backward compatibility
// New code should import from '@/lib/utils/excel' directly.
export {
  type TargetField,
  type FieldGroup,
  type ContactChannelKey,
  type ContactChannelOption,
  type ContactEntry,
  type ImportDefaultValues,
  ORDER_IMPORT_FIELDS,
  DUOLINGO_EXTRA_FIELDS,
  FIELD_GROUP_META,
  CONTACT_CHANNEL_OPTIONS,
  safeStringify,
  detectHeaderRowIndex,
  fuzzyMatchHeaders,
  extractMappedData,
  excelDateToJSDateString,
  parseVietnameseDateStr,
  parseExcelDate,
  parseDuolingoField,
  parseFacebookUrl,
  normalizePlanName,
  normalizePaymentStatus,
  smartExtractCustomerName,
} from './utils/excel'

import * as XLSX from 'xlsx';

export interface ColumnMapping {
  techId: string;
  techName: string;
  address: string;
  date: string;
  // Optional extra columns to combine into address
  addressStreetNo?: string;
  addressStreetName?: string;
  addressStreetType?: string;
  addressSuffix?: string;
  addressMunicipality?: string;
  addressMode: 'single' | 'combined';
}

export interface ParsedJob {
  techId: string;
  techName: string;
  address: string;
  date: string;
}

export interface ParseResult {
  jobs: ParsedJob[];
  columnMapping: ColumnMapping;
  detectedHeaders: string[];
  totalRows: number;
  validRows: number;
  dateRange: { start: string; end: string };
  preview: ParsedJob[];
}

// Ordered from most specific to most generic
const TECH_ID_PATTERNS = [
  'primary tech', 'primarytech', 'primary technician',
  'tech_id', 'techid', 'tech id', 'employee id', 'emp id',
  'technician id', 'tech#', 'tech no', 'tech number',
  'emp#', 'staff id', 'worker id', 'crew id', 'field id',
  'f code', 'id'
];

const TECH_NAME_PATTERNS = [
  'burial crew', 'burialcrew', 'crew name', 'crewname',
  'tech name', 'technician name', 'employee name', 'tech full name',
  'name', 'technician', 'employee', 'staff name', 'worker name',
  'full name', 'crew', 'tech'
];

// Full-address patterns (a single column containing the complete address)
const FULL_ADDRESS_PATTERNS = [
  'service address', 'full address', 'job address', 'property address',
  'site address', 'burial address', 'street address', 'address',
  'location', 'site', 'property', 'destination'
];

// Component-based address patterns
const STREET_NO_PATTERNS = ['street no', 'street number', 'house no', 'house number', 'st no', 'number', 'street'];
const STREET_NAME_PATTERNS = ['street name', 'st name', 'road name'];
const STREET_TYPE_PATTERNS = ['street type', 'st type', 'road type'];
const SUFFIX_PATTERNS = ['suffix', 'suf'];
const MUNICIPALITY_PATTERNS = ['municipality', 'city', 'town', 'province', 'region', 'location'];

const DATE_PATTERNS = [
  'crew work complete date', 'work complete date', 'completion date',
  'complete date', 'date completed', 'date of service',
  'job date', 'service date', 'completed date', 'work date',
  'schedule date', 'scheduled date', 'date', 'day'
];

function norm(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function detectColumn(headers: string[], patterns: string[]): string | null {
  const normalized = headers.map(h => ({ original: h, n: norm(h) }));

  // Exact match first (most specific)
  for (const pattern of patterns) {
    const match = normalized.find(h => h.n === pattern);
    if (match) return match.original;
  }

  // Substring match
  for (const pattern of patterns) {
    const match = normalized.find(h => h.n.includes(pattern));
    if (match) return match.original;
  }

  return null;
}

// Month name to number mapping
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function parseExcelDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  // Excel numeric serial date
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    } catch { /* fall through */ }
  }

  const str = String(value).trim();
  if (!str) return '';

  // "Apr 27 2026 8:28PM" or "Apr 27 2026 8:28AM" — most common in this app
  const mdy = str.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (mdy) {
    const [, mon, day, year] = mdy;
    const m = MONTHS[mon.toLowerCase()];
    if (m) return `${year}-${m}-${day.padStart(2, '0')}`;
  }

  // "Apr 27 2026" without time
  const mdy2 = str.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy2) {
    const [, mon, day, year] = mdy2;
    const m = MONTHS[mon.toLowerCase()];
    if (m) return `${year}-${m}-${day.padStart(2, '0')}`;
  }

  // "MM/DD/YYYY" or "M/D/YYYY"
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mo, d, y] = slash;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "YYYY-MM-DD" — already correct
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // "DD-MM-YYYY" or "DD/MM/YYYY"
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, mo, y] = dmy;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

  return str;
}

function cleanTechName(name: string): string {
  // "Crew 01 - Lee Odusanya" → "Lee Odusanya"
  // Keep if it doesn't match the pattern
  const crewMatch = name.match(/^Crew\s+\d+\s*-\s*(.+)$/i);
  return crewMatch ? crewMatch[1].trim() : name;
}

function buildCombinedAddress(row: Record<string, unknown>, mapping: ColumnMapping): string {
  const parts: string[] = [];

  if (mapping.addressStreetNo) {
    const v = String(row[mapping.addressStreetNo] ?? '').trim();
    if (v) parts.push(v);
  }
  if (mapping.addressStreetName) {
    const v = String(row[mapping.addressStreetName] ?? '').trim();
    if (v) parts.push(v);
  }
  if (mapping.addressStreetType) {
    const v = String(row[mapping.addressStreetType] ?? '').trim();
    if (v) parts.push(v);
  }
  if (mapping.addressSuffix) {
    const v = String(row[mapping.addressSuffix] ?? '').trim();
    if (v) parts.push(v);
  }

  let address = parts.join(' ');

  if (mapping.addressMunicipality) {
    const v = String(row[mapping.addressMunicipality] ?? '').trim();
    if (v) address += (address ? ', ' : '') + v;
  }

  return address;
}

function getAddress(row: Record<string, unknown>, mapping: ColumnMapping): string {
  if (mapping.addressMode === 'combined') {
    return buildCombinedAddress(row, mapping);
  }
  return String(row[mapping.address] ?? '').trim();
}

// Detect whether the "address" column contains only numbers (just street numbers)
function isStreetNumberColumn(rows: Record<string, unknown>[], col: string): boolean {
  const sample = rows.slice(0, 20).map(r => String(r[col] ?? '').trim()).filter(Boolean);
  if (sample.length === 0) return false;
  const numericCount = sample.filter(v => /^\d+$/.test(v)).length;
  return numericCount / sample.length > 0.7;
}

export function parseExcelFile(filePath: string, customMapping?: Partial<ColumnMapping>): ParseResult {
  const workbook = XLSX.readFile(filePath, { type: 'file', cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true,
  });

  if (rows.length === 0) {
    throw new Error('No data found in the Excel file. Ensure the sheet has data rows.');
  }

  const headers = Object.keys(rows[0]);

  // --- Auto-detect columns ---
  const autoTechId = detectColumn(headers, TECH_ID_PATTERNS) || headers[0];
  const autoTechName = detectColumn(headers, TECH_NAME_PATTERNS) || headers[1] || headers[0];
  const autoDate = detectColumn(headers, DATE_PATTERNS) || headers[headers.length - 1];

  // Address detection: try single column first, then fall back to components
  let autoAddressMode: 'single' | 'combined' = 'single';
  let autoAddress = detectColumn(headers, FULL_ADDRESS_PATTERNS);
  let autoStreetNo: string | undefined;
  let autoStreetName: string | undefined;
  let autoStreetType: string | undefined;
  let autoSuffix: string | undefined;
  let autoMunicipality: string | undefined;

  if (autoAddress && !isStreetNumberColumn(rows, autoAddress)) {
    // Good single column with real addresses
    autoAddressMode = 'single';
  } else {
    // Try component detection
    autoStreetNo = detectColumn(headers, STREET_NO_PATTERNS) || undefined;
    autoStreetName = detectColumn(headers, STREET_NAME_PATTERNS) || undefined;
    autoStreetType = detectColumn(headers, STREET_TYPE_PATTERNS) || undefined;
    autoSuffix = detectColumn(headers, SUFFIX_PATTERNS) || undefined;
    autoMunicipality = detectColumn(headers, MUNICIPALITY_PATTERNS) || undefined;

    if (autoStreetName || autoStreetNo) {
      autoAddressMode = 'combined';
      // Use street name as the "primary" address column reference
      autoAddress = autoStreetName || autoStreetNo || headers[2];
    } else {
      autoAddress = autoAddress || headers[2] || headers[0];
      autoAddressMode = 'single';
    }
  }

  // Apply custom mapping overrides
  const mapping: ColumnMapping = {
    techId: customMapping?.techId || autoTechId,
    techName: customMapping?.techName || autoTechName,
    address: customMapping?.address || autoAddress || headers[2],
    date: customMapping?.date || autoDate,
    addressMode: customMapping?.addressMode || autoAddressMode,
    addressStreetNo: customMapping?.addressStreetNo ?? autoStreetNo,
    addressStreetName: customMapping?.addressStreetName ?? autoStreetName,
    addressStreetType: customMapping?.addressStreetType ?? autoStreetType,
    addressSuffix: customMapping?.addressSuffix ?? autoSuffix,
    addressMunicipality: customMapping?.addressMunicipality ?? autoMunicipality,
  };

  // --- Parse rows ---
  const jobs: ParsedJob[] = [];
  const dates: string[] = [];

  for (const row of rows) {
    const techId = String(row[mapping.techId] ?? '').trim();
    const rawName = String(row[mapping.techName] ?? '').trim();
    const techName = cleanTechName(rawName) || techId;
    const address = getAddress(row, mapping);
    const date = parseExcelDate(row[mapping.date]);

    if (!techId || !address || !date) continue;

    jobs.push({ techId, techName, address, date });
    dates.push(date);
  }

  dates.sort();

  return {
    jobs,
    columnMapping: mapping,
    detectedHeaders: headers,
    totalRows: rows.length,
    validRows: jobs.length,
    dateRange: {
      start: dates[0] || '',
      end: dates[dates.length - 1] || '',
    },
    preview: jobs.slice(0, 10),
  };
}

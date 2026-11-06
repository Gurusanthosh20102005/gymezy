/**
 * exportHelper.js
 * Single Source of Truth (SSOT) utility for exporting tabular backend data into CSV/Excel
 * with proper UTF-8 BOM encoding for special characters, currency symbols, and multi-line strings.
 */

/**
 * Escapes a cell value for safe CSV encoding (RFC 4180 compliant)
 * @param {any} value - Cell value
 * @returns {string} - CSV safe escaped cell string
 */
export const escapeCSVCell = (value) => {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // If the cell contains quotes, commas, newlines, or carriage returns, wrap in quotes and escape quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
};

/**
 * Generates and downloads a CSV file with UTF-8 BOM
 * @param {string} fileName - Destination file name without or with .csv extension
 * @param {string[]} headers - Array of column header names
 * @param {Array<Array<any>>} rows - 2D array of rows
 */
export const downloadCSV = (fileName, headers, rows) => {
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    throw new Error('Headers and rows must be arrays');
  }

  const cleanFileName = fileName?.endsWith('.csv') ? fileName : `${fileName || 'export'}.csv`;
  const headerLine = headers.map(escapeCSVCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCSVCell).join(','));

  // UTF-8 Byte Order Mark (BOM) allows Excel to recognize UTF-8 encoding automatically
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Formats standard export file name with timestamp
 * @param {string} moduleName - Module identifier (e.g. 'Customers', 'Gyms', 'Bookings')
 * @returns {string} - Default file name
 */
export const getDefaultExportFileName = (moduleName) => {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `Gymezy_${moduleName.replace(/\s+/g, '_')}_${dateStr}`;
};


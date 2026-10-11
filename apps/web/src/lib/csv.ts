/**
 * CSV export, once.
 *
 * Several pages had an "Export" button with no handler, and the ones that did
 * export each re-implemented quoting (some not at all, so a name with a comma
 * became two columns). This is RFC 4180 quoting plus a download.
 */

export type CsvValue = string | number | boolean | null | undefined;

/** Quote a cell when it holds a comma, a quote or a line break. */
export function csvCell(value: CsvValue): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
}

/** Build the CSV and hand it to the browser as a file named `name-YYYY-MM-DD.csv`. */
export function downloadCsv(name: string, header: string[], rows: CsvValue[][]): void {
  const blob = new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

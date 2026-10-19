/**
 * CSV for the partner exports (RFC 4180, CRLF line ends, UTF-8 with a BOM
 * so spreadsheet programs read accents correctly).
 *
 * Spreadsheet formula injection is neutralised: a cell that starts with
 * = + - @ (or a tab / carriage return) is prefixed with a quote, unless it
 * is a plain signed decimal number such as -24.75, which stays a number.
 */

const NUMBER = /^-?\d+(\.\d+)?$/;
const DANGEROUS_START = /^[=+\-@\t\r]/;

export function csvCell(value: string): string {
  let cell = value;
  if (DANGEROUS_START.test(cell) && !NUMBER.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCsv(header: string[], rows: string[][]): string {
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

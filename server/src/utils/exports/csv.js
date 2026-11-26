const { Parser } = require('json2csv');

const escapeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

/** Builds CSV text from display rows and column definitions. */
const buildCsv = ({ columns = [], rows = [] }) => {
  const fields = columns.map((column) => ({
    label: column.header,
    value: (row) => escapeValue(row[column.key]),
  }));
  const parser = new Parser({ fields, withBOM: true });
  return parser.parse(rows);
};

/** Builds CSV for a meta/header block plus table. */
const buildCsvWithMeta = ({ title, meta = [], columns = [], rows = [] }) => {
  const headerLines = [];
  if (title) headerLines.push(`"${title}"`);
  meta.forEach((item) => {
    const text = typeof item === 'string' ? item : `${item.label}: ${item.value}`;
    headerLines.push(`"${String(text).replace(/"/g, '""')}"`);
  });
  headerLines.push('');
  return `${headerLines.join('\n')}\n${buildCsv({ columns, rows })}`;
};

module.exports = { buildCsv, buildCsvWithMeta };

const { buildExcelBuffer } = require('./excel');
const { buildCsvWithMeta, buildCsv } = require('./csv');
const { buildPdfBuffer } = require('./pdf');
const ApiError = require('../ApiError');

const MIME_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

const normalizeFormat = (format) => {
  const value = String(format || 'xlsx').toLowerCase();
  if (value === 'excel') return 'xlsx';
  if (!['xlsx', 'csv', 'pdf'].includes(value)) {
    throw ApiError.badRequest('Unsupported export format. Use xlsx, csv or pdf.');
  }
  return value;
};

/**
 * Generates the requested format and streams it to the client.
 * options: { format, baseName, title, subtitle, meta, columns, rows, summary, sheetName }
 */
const sendExport = async (res, options) => {
  const format = normalizeFormat(options.format);
  const baseName = (options.baseName || 'hrms-report').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
  const fileName = `${baseName}-${new Date().toISOString().slice(0, 10)}.${format}`;

  let buffer;
  if (format === 'csv') {
    buffer = Buffer.from(
      options.meta && options.meta.length
        ? buildCsvWithMeta({ title: options.title, meta: options.meta, columns: options.columns, rows: options.rows })
        : buildCsv({ columns: options.columns, rows: options.rows }),
      'utf8',
    );
  } else if (format === 'pdf') {
    buffer = await buildPdfBuffer(options);
  } else {
    buffer = await buildExcelBuffer({ ...options, sheetName: options.sheetName || options.title || 'Report' });
  }

  res.setHeader('Content-Type', MIME_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-store');
  return res.send(buffer);
};

module.exports = { sendExport, normalizeFormat, MIME_TYPES };

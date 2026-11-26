const PDFDocument = require('pdfkit');

// PDFKit built-in fonts only support Latin-1; normalise unsupported glyphs.
const sanitize = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replace(/\u20b9/g, 'Rs.')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x00-\xFF]/g, '?');

const PAGE_MARGIN = 40;
const HEADER_COLOR = '#1e3a8a';
const GRID_COLOR = '#cbd5e1';
const TEXT_COLOR = '#0f172a';

/**
 * Renders a printable PDF report with header, meta block, table and summary.
 */
const buildPdfBuffer = ({ title, subtitle, meta = [], columns = [], rows = [], summary = [], footer }) =>
  new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;
      const contentBottom = () => doc.page.height - PAGE_MARGIN - 30;

      const drawPageHeader = () => {
        doc.rect(0, 0, doc.page.width, 70).fill(HEADER_COLOR);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(sanitize(title || 'Report'), PAGE_MARGIN, 22, {
          width: pageWidth,
        });
        if (subtitle) {
          doc.font('Helvetica').fontSize(9).fillColor('#dbeafe').text(sanitize(subtitle), PAGE_MARGIN, 44, {
            width: pageWidth,
          });
        }
        doc.y = 86;
      };

      drawPageHeader();

      doc.fillColor('#334155').font('Helvetica').fontSize(9);
      meta.filter(Boolean).forEach((item) => {
        const text = typeof item === 'string' ? item : `${item.label}: ${item.value}`;
        doc.text(sanitize(text), PAGE_MARGIN, doc.y, { width: pageWidth });
      });
      doc.moveDown(0.8);

      const totalWidth = pageWidth;
      const columnWidths = columns.map((column) => (column.width ? (column.width / 100) * totalWidth : totalWidth / columns.length));
      const rowPadding = 5;
      const fontSize = 8;
      const cellPadding = 4;

      const measureRow = (row) => {
        let maxHeight = 0;
        columns.forEach((column, index) => {
          const text = sanitize(row[column.key] ?? '');
          const height = doc.font('Helvetica').fontSize(fontSize).heightOfString(text, {
            width: columnWidths[index] - cellPadding * 2,
          });
          maxHeight = Math.max(maxHeight, height);
        });
        return maxHeight + rowPadding * 2;
      };

      const drawHeaderRow = () => {
        const y = doc.y;
        doc.rect(PAGE_MARGIN, y, totalWidth, 22).fill('#e2e8f0');
        let x = PAGE_MARGIN;
        columns.forEach((column, index) => {
          doc
            .fillColor(TEXT_COLOR)
            .font('Helvetica-Bold')
            .fontSize(fontSize)
            .text(sanitize(column.header), x + cellPadding, y + 7, {
              width: columnWidths[index] - cellPadding * 2,
              ellipsis: true,
            });
          x += columnWidths[index];
        });
        doc.y = y + 22;
        doc.fillColor(TEXT_COLOR).font('Helvetica').fontSize(fontSize);
      };

      drawHeaderRow();

      if (!rows.length) {
        doc.moveDown(1);
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b').text('No records found for the selected filters.', PAGE_MARGIN);
        doc.fillColor(TEXT_COLOR).font('Helvetica');
      }

      rows.forEach((row, rowIndex) => {
        const height = measureRow(row);
        if (doc.y + height > contentBottom()) {
          doc.addPage();
          drawPageHeader();
          drawHeaderRow();
        }
        const y = doc.y;
        let x = PAGE_MARGIN;
        if (rowIndex % 2 === 1) {
          doc.rect(PAGE_MARGIN, y, totalWidth, height).fill('#f8fafc');
        }
        columns.forEach((column, index) => {
          doc
            .fillColor(TEXT_COLOR)
            .font('Helvetica')
            .fontSize(fontSize)
            .text(sanitize(row[column.key] ?? ''), x + cellPadding, y + rowPadding, {
              width: columnWidths[index] - cellPadding * 2,
            });
          x += columnWidths[index];
        });
        doc
          .moveTo(PAGE_MARGIN, y + height)
          .lineTo(PAGE_MARGIN + totalWidth, y + height)
          .strokeColor(GRID_COLOR)
          .lineWidth(0.5)
          .stroke();
        doc.y = y + height;
      });

      if (summary.length) {
        if (doc.y + 20 + summary.length * 16 > contentBottom()) {
          doc.addPage();
          drawPageHeader();
        }
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(HEADER_COLOR).text('Summary', PAGE_MARGIN, doc.y);
        doc.moveDown(0.3);
        summary.forEach((item) => {
          doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_COLOR).text(sanitize(`${item.label}: `), PAGE_MARGIN, doc.y, {
            continued: true,
          });
          doc.font('Helvetica').text(sanitize(item.value));
        });
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748b')
          .text(
            sanitize(footer || `Generated on ${new Date().toLocaleString()} by HRMS`),
            PAGE_MARGIN,
            doc.page.height - PAGE_MARGIN - 10,
            { width: pageWidth / 2 },
          );
        doc.text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN + pageWidth / 2, doc.page.height - PAGE_MARGIN - 10, {
          width: pageWidth / 2,
          align: 'right',
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });

module.exports = { buildPdfBuffer, sanitize };

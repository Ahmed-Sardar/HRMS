const ExcelJS = require('exceljs');

/**
 * Builds a professionally formatted .xlsx buffer.
 * columns: [{ header, key, width }]
 * rows: array of plain objects (values already formatted for display)
 */
const buildExcelBuffer = async ({ sheetName = 'Report', title, subtitle, meta = [], columns = [], rows = [], summary = [] }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HRMS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 30), {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  const totalColumns = Math.max(columns.length, 2);
  const lastColumnLetter = sheet.getColumn(totalColumns).letter;

  if (title) {
    sheet.mergeCells(`A1:${lastColumnLetter}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 26;
  }

  let cursor = title ? 2 : 1;
  if (subtitle) {
    sheet.mergeCells(`A${cursor}:${lastColumnLetter}${cursor}`);
    const cell = sheet.getCell(`A${cursor}`);
    cell.value = subtitle;
    cell.font = { size: 11, color: { argb: 'FF475569' } };
    cursor += 1;
  }

  meta.filter(Boolean).forEach((item) => {
    sheet.mergeCells(`A${cursor}:${lastColumnLetter}${cursor}`);
    const cell = sheet.getCell(`A${cursor}`);
    cell.value = typeof item === 'string' ? item : `${item.label}: ${item.value}`;
    cell.font = { size: 10, color: { argb: 'FF334155' } };
    cursor += 1;
  });

  cursor += 1;
  const headerRow = sheet.getRow(cursor);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    sheet.getColumn(index + 1).width = column.width || 20;
  });
  headerRow.height = 22;
  headerRow.commit();

  const firstDataRow = cursor + 1;
  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(firstDataRow + rowIndex);
    columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      cell.value = row[column.key] === undefined || row[column.key] === null ? '' : row[column.key];
      cell.font = { size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', wrapText: Boolean(column.wrap) };
      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
    });
  });

  if (rows.length === 0) {
    const emptyRow = sheet.getRow(firstDataRow);
    sheet.mergeCells(`A${firstDataRow}:${lastColumnLetter}${firstDataRow}`);
    const cell = sheet.getCell(`A${firstDataRow}`);
    cell.value = 'No records found for the selected filters.';
    cell.font = { italic: true, color: { argb: 'FF64748B' } };
    emptyRow.commit();
  }

  if (summary.length) {
    let summaryRowIndex = firstDataRow + rows.length + 2;
    summary.forEach((item) => {
      const row = sheet.getRow(summaryRowIndex);
      row.getCell(1).value = item.label;
      row.getCell(1).font = { bold: true, size: 10 };
      row.getCell(2).value = item.value;
      row.getCell(2).font = { size: 10 };
      row.commit();
      summaryRowIndex += 1;
    });
  }

  const footerRowIndex = firstDataRow + rows.length + summary.length + 4;
  sheet.mergeCells(`A${footerRowIndex}:${lastColumnLetter}${footerRowIndex}`);
  const footer = sheet.getCell(`A${footerRowIndex}`);
  footer.value = `Generated on ${new Date().toLocaleString()} by HRMS`;
  footer.font = { size: 9, italic: true, color: { argb: 'FF64748B' } };

  sheet.autoFilter = {
    from: { row: cursor, column: 1 },
    to: { row: cursor + rows.length, column: columns.length },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

module.exports = { buildExcelBuffer };

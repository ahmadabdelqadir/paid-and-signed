// Draws the receipt onto a canvas and wraps it in a one-page A4 PDF.
// Drawing it this way lets iOS lay out Hebrew correctly, and needs
// no libraries or internet connection.
import { translator, money, longDate, dateTime, receiptNumber, isRtl } from './i18n.js';
import { drawSignature } from './signature.js';

const W = 1000;
const H = 1414;
const M = 72;
const PDF_SCALE = 2.1;

const INK = '#23252B';
const MUTE = '#5E6169';
const CARBON = '#1E2C9B';
const RED = '#C8202F';
const RULE = '#D9D9D2';

const DISPLAY = '"DIN Condensed",system-ui,"Arial Hebrew",sans-serif';
const TEXT = '"Avenir Next",system-ui,"Arial Hebrew",sans-serif';

function wrap(g, text, maxWidth, maxLines) {
  const lines = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const attempt = line ? `${line} ${word}` : word;
      if (g.measureText(attempt).width <= maxWidth) {
        line = attempt;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      // A single word wider than the column gets broken up.
      while (g.measureText(line).width > maxWidth) {
        let cut = line.length - 1;
        while (cut > 1 && g.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

// paidToDate is passed in for drafts, which do not have a signed figure yet.
export function renderReceipt(r, { lang, payer, project, paidToDate }, scale = 1) {
  const useLang = (r.status === 'signed' && r.lang) || lang;
  const t = translator(useLang);
  const rtl = isRtl(useLang);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  g.direction = rtl ? 'rtl' : 'ltr';

  const X = (x) => (rtl ? W - x : x);
  const rectX = (x, w) => (rtl ? W - x - w : x);
  const write = (text, x, y, font, color, align = 'start') => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = align;
    g.fillText(text, X(x), y);
  };
  // Amounts always read left to right, even on a Hebrew receipt.
  const writeFigure = (text, x, y, font, color, side) => {
    g.save();
    g.direction = 'ltr';
    g.font = font;
    g.fillStyle = color;
    const atStart = side === 'start';
    g.textAlign = atStart === rtl ? 'right' : 'left';
    g.fillText(text, X(x), y);
    g.restore();
  };
  const rule = (x, y, w, color = RULE, h = 1.5) => {
    g.fillStyle = color;
    g.fillRect(rectX(x, w), y, w, h);
  };

  const payerName = r.payer || payer;
  const projectName = r.project || project;
  const figureMoney = (n) => money(n, r.currency);

  // Heading and serial number
  const isSigned = r.status === 'signed';
  const serial = isSigned ? `${t('no')} ${receiptNumber(r.number)}` : t('draft');
  const serialSize = 60;
  g.font = `bold ${serialSize}px ${DISPLAY}`;
  const titleMax = W - 2 * M - g.measureText(serial).width - 40;
  let titleSize = 92;
  g.font = `bold ${titleSize}px ${DISPLAY}`;
  while (g.measureText(t('pdfTitle')).width > titleMax && titleSize > 40) {
    titleSize -= 2;
    g.font = `bold ${titleSize}px ${DISPLAY}`;
  }
  write(t('pdfTitle'), M, 134, `bold ${titleSize}px ${DISPLAY}`, INK);
  write(serial, W - M, 134, `bold ${serialSize}px ${DISPLAY}`, isSigned ? RED : MUTE, 'end');
  if (projectName) write(projectName, M, 178, `500 27px ${TEXT}`, MUTE);

  // Amount band
  const bandTop = 208;
  const bandH = 204;
  const bandPad = 36;
  g.fillStyle = CARBON;
  g.fillRect(M, bandTop, W - 2 * M, bandH);
  write(t('pdfAmount'), M + bandPad, bandTop + 52, `600 26px ${TEXT}`, '#FFFFFF');

  const hasAccount = r.agreedTotal != null;
  const accountW = 310;
  const amountMax = W - 2 * M - 2 * bandPad - (hasAccount ? accountW + 28 : 0);
  let amountSize = 136;
  const amountText = figureMoney(r.amount);
  g.font = `bold ${amountSize}px ${DISPLAY}`;
  while (g.measureText(amountText).width > amountMax && amountSize > 60) {
    amountSize -= 4;
    g.font = `bold ${amountSize}px ${DISPLAY}`;
  }
  writeFigure(amountText, M + bandPad, bandTop + 172, `bold ${amountSize}px ${DISPLAY}`, '#FFFFFF', 'start');

  if (hasAccount) {
    const remaining = Math.max(0, Math.round((r.agreedTotal - paidToDate) * 100) / 100);
    const rows = [
      [t('pdfAgreed'), r.agreedTotal],
      [t('pdfPaidToDate'), paidToDate],
      [t('pdfRemaining'), remaining],
    ];
    const end = W - M - bandPad;
    const start = end - accountW;
    rows.forEach(([label, value], i) => {
      const y = bandTop + 60 + i * 52;
      write(label, start, y, `500 24px ${TEXT}`, '#FFFFFF');
      writeFigure(figureMoney(value), end, y, `bold 34px ${DISPLAY}`, '#FFFFFF', 'end');
    });
  }

  // Details
  const methodText = t(`method_${r.method}`) + (r.reference ? `, ${r.reference}` : '');
  const paidToText = r.recipient + (r.recipientId ? `\n${r.recipientId}` : '');
  const rows = [
    [t('pdfDate'), longDate(r.date, useLang), 1],
    [t('pdfPaidTo'), paidToText, 3],
    [t('pdfPaidBy'), payerName, 2],
    [t('pdfFor'), r.description, 8],
    [t('pdfStage'), r.stage, 2],
    [t('pdfMethod'), methodText, 2],
    [t('pdfNotes'), r.notes, 5],
  ].filter(([, value]) => value);

  const rowsTop = 446;
  const rowsLimit = 975;
  const labelW = 214;
  const valueW = W - 2 * M - labelW;

  const layout = (f) => {
    g.font = `500 ${31 * f}px ${TEXT}`;
    const lineH = 42 * f;
    const pad = 15 * f;
    let height = 0;
    const laid = rows.map(([label, value, maxLines]) => {
      const lines = wrap(g, value, valueW, maxLines);
      const rowH = lines.length * lineH + pad * 2;
      height += rowH;
      return { label, lines, rowH };
    });
    return { laid, height, lineH, pad };
  };

  let factor = 1;
  let result = layout(factor);
  while (rowsTop + result.height > rowsLimit && factor > 0.6) {
    factor -= 0.05;
    result = layout(factor);
  }

  let y = rowsTop;
  for (const row of result.laid) {
    const first = y + result.pad + 31 * factor;
    write(row.label, M, first, `500 ${25 * factor}px ${TEXT}`, MUTE);
    row.lines.forEach((line, i) => {
      write(line, M + labelW, first + i * result.lineH, `600 ${31 * factor}px ${TEXT}`, INK);
    });
    y += row.rowH;
    rule(M, y, W - 2 * M);
  }

  // Confirmation sentence
  const statement = t('pdfStatement', {
    recipient: r.recipient,
    payer: payerName,
    date: longDate(r.date, useLang),
  });
  g.font = `500 28px ${TEXT}`;
  wrap(g, statement, W - 2 * M, 3).forEach((line, i) => {
    write(line, M, 1040 + i * 40, `500 28px ${TEXT}`, INK);
  });

  // Signatures
  const gap = 56;
  const colW = (W - 2 * M - gap) / 2;
  const blocks = [
    { x: M, title: t('pdfSignRecipient'), name: r.recipient, sig: r.signatures?.recipient },
    { x: M + colW + gap, title: t('pdfSignPayer'), name: payerName, sig: r.signatures?.payer },
  ];
  for (const block of blocks) {
    write(block.title, block.x, 1160, `500 24px ${TEXT}`, MUTE);
    if (block.sig) {
      drawSignature(g, block.sig, { x: rectX(block.x, colW) + 8, y: 1170, w: colW - 16, h: 108 });
    }
    rule(block.x, 1284, colW, INK, 2);
    g.font = `600 27px ${TEXT}`;
    write(wrap(g, block.name, colW, 1)[0], block.x, 1320, `600 27px ${TEXT}`, INK);
    write(
      block.sig ? t('pdfSignedAt', { when: dateTime(block.sig.at, useLang) }) : t('pdfNotSigned'),
      block.x,
      1354,
      `500 22px ${TEXT}`,
      MUTE
    );
  }

  return canvas;
}

function jpegOf(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not draw the receipt'))), 'image/jpeg', 0.94);
  });
}

const bytes = (s) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i) & 255;
  return out;
};

function utf16Hex(text) {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i += 1) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return hex;
}

async function canvasToPdf(canvas, title) {
  const jpeg = new Uint8Array(await (await jpegOf(canvas)).arrayBuffer());
  const pageW = 595.28;
  const pageH = 841.89;
  const parts = [];
  const offsets = [];
  let offset = 0;
  const push = (b) => {
    parts.push(b);
    offset += b.length;
  };
  const text = (s) => push(bytes(s));
  const object = (n, body) => {
    offsets[n] = offset;
    text(`${n} 0 obj\n${body}\nendobj\n`);
  };

  text('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = offset;
  text(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  text('\nendstream\nendobj\n');
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title <${utf16Hex(title)}> /Producer (Paid and Signed) >>`);

  const start = offset;
  text('xref\n0 7\n0000000000 65535 f \n');
  for (let n = 1; n <= 6; n += 1) text(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export async function buildPdfFile(r, options) {
  const canvas = renderReceipt(r, options, PDF_SCALE);
  const number = receiptNumber(r.number);
  const label = translator(r.lang || options.lang)('receiptNo', { n: number });
  const blob = await canvasToPdf(canvas, label);
  // Free the large canvas straight away. iOS is strict about canvas memory.
  canvas.width = 0;
  canvas.height = 0;
  const safeName = r.recipient.replace(/[\\/:*?"<>|]/g, '').trim();
  return new File([blob], `${label} ${safeName} ${r.date}.pdf`, { type: 'application/pdf' });
}

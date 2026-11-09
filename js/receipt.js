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
const TINT = '#F1F2F8';

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

  const isSigned = r.status === 'signed';
  const contentW = W - 2 * M;

  // Heading, with the receipt number set apart on the other side
  g.fillStyle = CARBON;
  g.fillRect(0, 0, W, 12);
  let titleSize = 76;
  g.font = `bold ${titleSize}px ${DISPLAY}`;
  while (g.measureText(t('pdfTitle')).width > contentW - 260 && titleSize > 40) {
    titleSize -= 2;
    g.font = `bold ${titleSize}px ${DISPLAY}`;
  }
  write(t('pdfTitle'), M, 122, `bold ${titleSize}px ${DISPLAY}`, INK);
  if (projectName) write(projectName, M, 166, `500 27px ${TEXT}`, MUTE);
  if (isSigned) {
    write(t('pdfReceiptNo'), W - M, 84, `500 23px ${TEXT}`, MUTE, 'end');
    write(receiptNumber(r.number), W - M, 142, `bold 58px ${DISPLAY}`, RED, 'end');
  } else {
    write(t('draft'), W - M, 122, `bold 46px ${DISPLAY}`, MUTE, 'end');
  }
  rule(M, 190, contentW, INK, 2.5);

  // Who and when
  const columns = [
    { w: 300, label: t('pdfPaidTo'), value: r.recipient, extra: r.recipientId },
    { w: 250, label: t('pdfPaidBy'), value: payerName },
    { w: 250, label: t('pdfDate'), value: longDate(r.date, useLang) },
  ];
  let columnX = M;
  for (const column of columns) {
    write(column.label, columnX, 236, `500 24px ${TEXT}`, MUTE);
    g.font = `600 30px ${TEXT}`;
    const lines = wrap(g, column.value, column.w, 2);
    lines.forEach((line, i) => write(line, columnX, 278 + i * 38, `600 30px ${TEXT}`, INK));
    if (column.extra) {
      g.font = `500 24px ${TEXT}`;
      write(wrap(g, column.extra, column.w, 1)[0], columnX, 278 + lines.length * 37, `500 24px ${TEXT}`, MUTE);
    }
    columnX += column.w + 28;
  }

  // Amount
  const panelTop = 380;
  const panelH = 176;
  const panelPad = 36;
  g.fillStyle = TINT;
  g.fillRect(M, panelTop, contentW, panelH);
  g.fillStyle = CARBON;
  g.fillRect(rectX(M, 8), panelTop, 8, panelH);
  write(t('pdfAmount'), M + panelPad, panelTop + 50, `600 26px ${TEXT}`, INK);

  const hasAccount = r.agreedTotal != null;
  const accountW = 330;
  const amountMax = contentW - panelPad - 32 - (hasAccount ? accountW + 56 : 0);
  let amountSize = 118;
  const amountText = figureMoney(r.amount);
  g.font = `bold ${amountSize}px ${DISPLAY}`;
  while (g.measureText(amountText).width > amountMax && amountSize > 56) {
    amountSize -= 4;
    g.font = `bold ${amountSize}px ${DISPLAY}`;
  }
  writeFigure(amountText, M + panelPad, panelTop + 148, `bold ${amountSize}px ${DISPLAY}`, CARBON, 'start');

  if (hasAccount) {
    const remaining = Math.max(0, Math.round((r.agreedTotal - paidToDate) * 100) / 100);
    const rows = [
      [t('pdfAgreed'), r.agreedTotal],
      [t('pdfPaidToDate'), paidToDate],
      [t('pdfRemaining'), remaining],
    ];
    const end = W - M - 32;
    const start = end - accountW;
    g.fillStyle = '#C9CBDA';
    g.fillRect(rectX(start - 28, 1.5), panelTop + 24, 1.5, panelH - 48);
    rows.forEach(([label, value], i) => {
      const y = panelTop + 50 + i * 49;
      const last = i === rows.length - 1;
      write(label, start, y, `${last ? 700 : 500} 25px ${TEXT}`, INK);
      writeFigure(figureMoney(value), end, y, `bold 36px ${DISPLAY}`, last ? CARBON : INK, 'end');
    });
  }

  // Details
  const methodText = t(`method_${r.method}`) + (r.reference ? `, ${r.reference}` : '');
  const rows = [
    [t('pdfFor'), r.description, 8],
    [t('pdfStage'), r.stage, 2],
    [t('pdfMethod'), methodText, 2],
    [t('pdfNotes'), r.notes, 5],
  ].filter(([, value]) => value);

  const rowsTop = 580;
  const rowsLimit = 950;
  const labelW = 200;
  const valueW = contentW - labelW;

  const layout = (f) => {
    g.font = `600 ${30 * f}px ${TEXT}`;
    const lineH = 41 * f;
    const pad = 16 * f;
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
    const first = y + result.pad + 30 * factor;
    write(row.label, M, first, `500 ${25 * factor}px ${TEXT}`, MUTE);
    row.lines.forEach((line, i) => {
      write(line, M + labelW, first + i * result.lineH, `600 ${30 * factor}px ${TEXT}`, INK);
    });
    y += row.rowH;
    rule(M, y, contentW);
  }

  // Confirmation sentence
  const statement = t('pdfStatement', {
    recipient: r.recipient,
    payer: payerName,
    date: longDate(r.date, useLang),
  });
  g.font = `500 27px ${TEXT}`;
  wrap(g, statement, contentW, 3).forEach((line, i) => {
    write(line, M, 996 + i * 39, `500 27px ${TEXT}`, INK);
  });

  // Signatures
  const gap = 56;
  const colW = (contentW - gap) / 2;
  const blocks = [
    { x: M, title: t('pdfSignRecipient'), name: r.recipient, sig: r.signatures?.recipient },
    { x: M + colW + gap, title: t('pdfSignPayer'), name: payerName, sig: r.signatures?.payer },
  ];
  for (const block of blocks) {
    write(block.title, block.x, 1128, `500 24px ${TEXT}`, MUTE);
    if (block.sig) {
      drawSignature(g, block.sig, { x: rectX(block.x, colW) + 8, y: 1138, w: colW - 16, h: 112 });
    }
    rule(block.x, 1256, colW, INK, 2);
    g.font = `600 27px ${TEXT}`;
    write(wrap(g, block.name, colW, 1)[0], block.x, 1292, `600 27px ${TEXT}`, INK);
    write(
      block.sig ? t('pdfSignedAt', { when: dateTime(block.sig.at, useLang) }) : t('pdfNotSigned'),
      block.x,
      1324,
      `500 22px ${TEXT}`,
      MUTE
    );
  }

  // Footer
  rule(M, 1354, contentW);
  write(t('pdfSignedOnPhone'), M, 1384, `500 20px ${TEXT}`, MUTE);
  if (isSigned) write(t('receiptNo', { n: receiptNumber(r.number) }), W - M, 1384, `500 20px ${TEXT}`, MUTE, 'end');

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

function fileLabel(r, options) {
  return translator(r.lang || options.lang)('receiptNo', { n: receiptNumber(r.number) });
}

function fileBaseName(r, options) {
  const safeName = r.recipient.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${fileLabel(r, options)} ${safeName} ${r.date}`;
}

// Frees the large canvas straight away. iOS is strict about canvas memory.
function release(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

export async function buildPdfFile(r, options) {
  const canvas = renderReceipt(r, options, PDF_SCALE);
  const blob = await canvasToPdf(canvas, fileLabel(r, options));
  release(canvas);
  return new File([blob], `${fileBaseName(r, options)}.pdf`, { type: 'application/pdf' });
}

export async function buildImageFile(r, options) {
  const canvas = renderReceipt(r, options, PDF_SCALE);
  const blob = await jpegOf(canvas);
  release(canvas);
  return new File([blob], `${fileBaseName(r, options)}.jpg`, { type: 'image/jpeg' });
}

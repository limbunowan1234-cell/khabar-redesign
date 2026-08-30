// lib/certGenerator.ts
// Client-side certificate generation: loads a template PNG, draws the winner's
// name onto it at the confirmed position, and returns a downloadable PNG blob.

export type CertRank = '1st' | '2nd' | '3rd' | 'participation';

const TEMPLATE_PATHS: Record<CertRank, string> = {
  '1st': '/certificates/1st.png',
  '2nd': '/certificates/2nd.png',
  '3rd': '/certificates/3rd.png',
  'participation': '/certificates/participation.png',
};

// Coordinates confirmed against the actual 1655x2340 template artwork.
const NAME_Y_FRACTION = 0.415;
const NAME_COLOR = '#131B2E';
const NAME_FONT = 'italic bold 62px Georgia, "Times New Roman", serif';
const MAX_NAME_WIDTH_FRACTION = 0.72; // shrink font if the name is too wide

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateCertificateBlob(name: string, rank: CertRank): Promise<Blob> {
  const img = await loadImage(TEMPLATE_PATHS[rank]);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, 0);

  // Fit the name within the allowed width, shrinking font size if needed
  let fontSize = 62;
  const maxWidth = canvas.width * MAX_NAME_WIDTH_FRACTION;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = NAME_COLOR;

  do {
    ctx.font = `italic bold ${fontSize}px Georgia, "Times New Roman", serif`;
    const width = ctx.measureText(name).width;
    if (width <= maxWidth || fontSize <= 28) break;
    fontSize -= 2;
  } while (true);

  const x = canvas.width / 2;
  const y = canvas.height * NAME_Y_FRACTION;
  ctx.fillText(name, x, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate certificate image'));
    }, 'image/png');
  });
}

// Nepali Bhasa Diwas certificate: recreates the look of the story-contest
// template above (navy/gold/cream palette, corner triangle motif, circular
// watermark seal, gold ornamental divider, logo, signature block) rather
// than reusing that template's actual PNG -- the contest-specific text on
// that asset ("Khabar Darjeeling Story Contest 2026", the story title)
// sits directly on top of the watermark seal and ornament line, so erasing
// it would leave a visible patch cutting through both. Drawing the same
// visual language fresh avoids that, and lets the whole thing be written
// in Devanagari (matching the labels already used elsewhere in this
// feature, e.g. CATS/MEDAL_LABELS in WinnersGallery.tsx) rather than only
// the name being swappable. Same canvas size/ratio as the real template
// (1655x2340) for a matching print/download size.
const BHASA_DIWAS_CATEGORY_LABEL: Record<string, string> = { poetry: 'काव्य', essay: 'निबन्ध' };
// Formal register (द्वितीय/तृतीय) for the printed certificate -- distinct
// from WinnersGallery.tsx's own colloquial दोस्रो/तेस्रो used in on-page UI.
const BHASA_DIWAS_RANK_LABEL: Record<CertRank, string> = { '1st': 'प्रथम', '2nd': 'द्वितीय', '3rd': 'तृतीय', 'participation': 'सहभागी' };

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[+d]);
}
function formatDevanagariDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return toDevanagariDigits(`${dd}/${mm}/${yyyy}`);
}

// Minimal rich-text word-wrap for canvas: canvas has no native paragraph
// layout, and the certificate's body text (see below) is a formal Nepali
// paragraph with the winner's name, the occasion, the category, and the
// rank bolded *inline* mid-sentence -- not standalone lines -- so a plain
// fillText() per line can't represent it. A "token" is one word plus
// whether it's bold and whether it needs a leading space (false for a
// suffix like "मा" that attaches directly to the bold word before it,
// matching Nepali postposition grammar).
type Token = { text: string; bold: boolean; spaceBefore: boolean };

function words(text: string, bold: boolean): Token[] {
  return text.split(' ').map((w) => ({ text: w, bold, spaceBefore: true }));
}

function wrapTokens(ctx: CanvasRenderingContext2D, tokens: Token[], maxWidth: number, normalFont: string, boldFont: string): Token[][] {
  ctx.font = normalFont;
  const spaceWidth = ctx.measureText(' ').width;
  const lines: Token[][] = [];
  let line: Token[] = [];
  let lineWidth = 0;

  for (const token of tokens) {
    ctx.font = token.bold ? boldFont : normalFont;
    const tokenWidth = ctx.measureText(token.text).width;
    const gap = line.length > 0 && token.spaceBefore ? spaceWidth : 0;
    if (line.length > 0 && lineWidth + gap + tokenWidth > maxWidth) {
      lines.push(line);
      line = [token];
      lineWidth = tokenWidth;
    } else {
      line.push(token);
      lineWidth += gap + tokenWidth;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

// Draws pre-wrapped lines centered on cx, each line's bold/normal runs
// measured and positioned individually (ctx.textAlign can only center a
// single run, not a line mixing two fonts). Returns the y position just
// after the last line, so callers can chain the next block beneath it.
function drawWrappedLines(ctx: CanvasRenderingContext2D, lines: Token[][], cx: number, startY: number, lineHeight: number, normalFont: string, boldFont: string, normalColor: string, boldColor: string): number {
  ctx.font = normalFont;
  const spaceWidth = ctx.measureText(' ').width;
  ctx.textAlign = 'left';
  let y = startY;
  for (const line of lines) {
    let total = 0;
    line.forEach((token, i) => {
      ctx.font = token.bold ? boldFont : normalFont;
      total += ctx.measureText(token.text).width;
      if (i > 0 && token.spaceBefore) total += spaceWidth;
    });
    let x = cx - total / 2;
    line.forEach((token, i) => {
      if (i > 0 && token.spaceBefore) x += spaceWidth;
      ctx.font = token.bold ? boldFont : normalFont;
      ctx.fillStyle = token.bold ? boldColor : normalColor;
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    });
    y += lineHeight;
  }
  return y;
}

const NAVY = '#131B2E';
const GOLD = '#b9975b';
const RED = '#c41e3a';
const CREAM = '#fdfaf5';

function drawCornerTriangles(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // A cluster of overlapping triangles in each of two opposite corners,
  // echoing the geometric motif on the story-contest template -- drawn as
  // paths rather than an image so it scales cleanly at any canvas size.
  function cluster(cx: number, cy: number, flipX: number, flipY: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flipX, flipY);

    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(260, 0); ctx.lineTo(0, 260); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#9ca3af';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(30, 130); ctx.lineTo(110, 100); ctx.lineTo(90, 175); ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 300); ctx.lineTo(300, 300); ctx.lineTo(300, 0);
    ctx.stroke();

    ctx.restore();
  }
  cluster(0, 0, 1, 1);
  cluster(width, height, -1, -1);
}

// A small flourish glyph (diamond–line–circle–line–diamond), echoing the
// divider ornament on the story-contest template.
function drawOrnamentalDivider(ctx: CanvasRenderingContext2D, cx: number, y: number, halfWidth: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = GOLD;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx - 40, y);
  ctx.moveTo(cx + 40, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, y, 6, 0, Math.PI * 2);
  ctx.fill();

  for (const dx of [-24, 24]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, y - 8);
    ctx.lineTo(cx + dx + (dx < 0 ? -10 : 10), y);
    ctx.lineTo(cx + dx, y + 8);
    ctx.lineTo(cx + dx + (dx < 0 ? 10 : -10), y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

// Faint circular seal behind the middle of the certificate -- a large,
// low-opacity "भाषा दिवस" watermark plus a ring, standing in for the
// story-contest template's translucent "DARJEELING" seal.
function drawWatermarkSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = RED;
  ctx.textAlign = 'center';
  ctx.font = 'bold 170px Georgia, "Noto Sans Devanagari", "Nirmala UI", sans-serif';
  ctx.fillText('भाषा', cx, cy - 20);
  ctx.fillText('दिवस', cx, cy + 170);
  ctx.restore();
}

export async function generateBhasaDiwasCertificateBlob(name: string, rank: CertRank, category: string): Promise<Blob> {
  const width = 1655;
  const height = 2340;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background + border, matching the real template's navy/gold framing.
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 8;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(62, 62, width - 124, height - 124);

  drawCornerTriangles(ctx, width, height);
  drawWatermarkSeal(ctx, width / 2, 1500, 480);

  // Logo, if it loads -- degrade gracefully to no-logo rather than fail
  // the whole certificate over a missing/blocked asset.
  try {
    const logo = await loadImage('/assets/logo.png');
    const logoSize = 150;
    const logoY = 200;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, logoY, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, width / 2 - logoSize / 2, logoY - logoSize / 2, logoSize, logoSize);
    ctx.restore();
  } catch { /* logo optional */ }

  const devanagariFont = (weight: string, size: number) =>
    `${weight} ${size}px Georgia, "Noto Sans Devanagari", "Nirmala UI", sans-serif`.trim();

  ctx.textAlign = 'center';
  ctx.fillStyle = NAVY;
  ctx.font = devanagariFont('bold', 96);
  ctx.fillText('प्रमाण–पत्र', width / 2, 400);

  ctx.font = devanagariFont('600', 46);
  ctx.fillStyle = '#444';
  ctx.fillText('उत्कृष्टता प्रमाण–पत्र', width / 2, 460);

  drawOrnamentalDivider(ctx, width / 2, 520, 460);

  const categoryLabel = BHASA_DIWAS_CATEGORY_LABEL[category] || category;
  const rankLabel = BHASA_DIWAS_RANK_LABEL[rank];
  const bodyNormalFont = devanagariFont('normal', 34);
  const bodyBoldFont = devanagariFont('bold', 34);
  const bodyMaxWidth = width * 0.8;

  // Body paragraph 1 -- exact wording as given, with the blanks filled
  // in: winner's name, "<category> प्रतियोगिता" (bold as one unit, "मा"
  // suffix attached with no space per Nepali grammar), and the rank +
  // "स्थान" (bold as one unit).
  const para1: Token[] = [
    ...words('यस प्रमाण–पत्रद्वारा', false),
    ...words(name, true),
    ...words('लाई', false),
    ...words('नेपाली भाषा दिवस २०२६', true),
    ...words('को अवसरमा आयोजित', false),
    { text: categoryLabel, bold: true, spaceBefore: true },
    { text: 'प्रतियोगिता', bold: true, spaceBefore: true },
    { text: 'मा', bold: false, spaceBefore: false },
    ...words('उत्कृष्ट प्रदर्शन गर्दै', false),
    { text: rankLabel, bold: true, spaceBefore: true },
    { text: 'स्थान', bold: true, spaceBefore: true },
    ...words('हासिल गर्नुभएकोमा हार्दिक बधाई तथा सम्मान व्यक्त गर्दछौँ।', false),
  ];

  const para2: Token[] = words(
    'नेपाली भाषा, साहित्य र संस्कृतिको संरक्षण, प्रवर्द्धन तथा विकासमा यहाँको योगदान र सहभागिताको उच्च कदर गर्दै यो प्रमाण–पत्र प्रदान गरिएको हो।',
    false
  );

  const closing: Token[] = words('हार्दिक बधाई तथा उज्ज्वल भविष्यको शुभकामना!', true);

  let y = 620;
  y = drawWrappedLines(ctx, wrapTokens(ctx, para1, bodyMaxWidth, bodyNormalFont, bodyBoldFont), width / 2, y, 58, bodyNormalFont, bodyBoldFont, '#2a2a2a', NAVY);
  y += 26;
  y = drawWrappedLines(ctx, wrapTokens(ctx, para2, bodyMaxWidth, bodyNormalFont, bodyNormalFont), width / 2, y, 54, bodyNormalFont, bodyNormalFont, '#3a3a3a', '#3a3a3a');
  y += 50;

  // Fixed floor so the closing wish/date/organizer block sits at a
  // consistent height regardless of how many lines the name/category
  // happened to wrap into above -- only pushed further down if the body
  // text actually runs long.
  y = Math.max(y, 1780);
  y = drawWrappedLines(ctx, wrapTokens(ctx, closing, bodyMaxWidth, bodyBoldFont, bodyBoldFont), width / 2, y, 58, bodyBoldFont, bodyBoldFont, RED, RED);
  y += 70;

  ctx.textAlign = 'center';
  ctx.font = devanagariFont('normal', 32);
  ctx.fillStyle = '#444';
  ctx.fillText(`मिति: ${formatDevanagariDate(new Date())}`, width / 2, y);
  y += 130;

  ctx.font = devanagariFont('normal', 28);
  ctx.fillStyle = '#777';
  ctx.fillText('आयोजक', width / 2, y);
  y += 56;
  ctx.font = devanagariFont('bold', 40);
  ctx.fillStyle = NAVY;
  ctx.fillText('खबर दार्जिलिङ', width / 2, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate certificate image'));
    }, 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

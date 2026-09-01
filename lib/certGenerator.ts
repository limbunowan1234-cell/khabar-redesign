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

// Nepali Bhasa Diwas certificate: real template art (public/certificates/
// bhasa-diwas.png), not code-drawn. The template already has the stamp
// baked in and the "प्रथम" (1st place) placeholder patched out to a blank
// -- built by compositing the organizer-supplied stamp onto the
// organizer-supplied certificate art (see git history for the exact
// crop/position), same "load template, draw dynamic text on top" pattern
// as generateCertificateBlob() above. Only two things are ever dynamic:
// the winner's name (into the blank "श्री/श्रीमती ____" line) and the rank
// word (into the patched gap -- प्रथम/द्वितीय/तृतीय, all fit the same
// space since the template's wording never names a category, covering
// "काव्य र निबन्ध प्रतियोगिता" generically).
const BHASA_DIWAS_TEMPLATE_PATH = '/certificates/bhasa-diwas.png';

// Formal register (द्वितीय/तृतीय) for the printed certificate -- distinct
// from WinnersGallery.tsx's own colloquial दोस्रो/तेस्रो used in on-page UI.
const BHASA_DIWAS_RANK_LABEL: Record<CertRank, string> = { '1st': 'प्रथम', '2nd': 'द्वितीय', '3rd': 'तृतीय', 'participation': 'सहभागी' };

// Coordinates confirmed against the actual 1280x904 template artwork
// (v2 -- the blank line was widened by the organizer after the first
// pass, and the rank word shifted a bit as a result; both recalibrated
// against that exact file, not assumed from the v1 layout).
const BHASA_DIWAS_NAME_X = 657; // the blank line's own center, not canvas.width/2
const BHASA_DIWAS_NAME_Y = 438;
const BHASA_DIWAS_NAME_MAX_WIDTH = 200; // the blank gap is ~215px wide now
const BHASA_DIWAS_RANK_X = 1063;
const BHASA_DIWAS_RANK_Y = 508;
const BHASA_DIWAS_TEXT_COLOR = '#1a1a1a';
// "Noto Serif Devanagari" is the site's own loaded Devanagari face (see
// app/layout.tsx's next/font/google setup) -- using it here, not a
// generic system-font fallback, is what actually matches the template
// art's own printed Devanagari instead of visibly clashing with it.
// Georgia still covers the Latin characters in an English name.
const BHASA_DIWAS_FONT = (weight: string, size: number) =>
  `${weight} ${size}px Georgia, "Noto Serif Devanagari", "Noto Sans Devanagari", "Nirmala UI", serif`;

export async function generateBhasaDiwasCertificateBlob(name: string, rank: CertRank): Promise<Blob> {
  const img = await loadImage(BHASA_DIWAS_TEMPLATE_PATH);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BHASA_DIWAS_TEXT_COLOR;

  // Winner's name on the blank line, shrinking to fit if it's long.
  // Regular weight, not bold -- matches the template's own printed text,
  // which is regular throughout (bold read as a mismatched font, not
  // just a different weight, next to the template's actual typeface).
  let nameSize = 32;
  do {
    ctx.font = BHASA_DIWAS_FONT('normal', nameSize);
    if (ctx.measureText(name).width <= BHASA_DIWAS_NAME_MAX_WIDTH || nameSize <= 16) break;
    nameSize -= 1;
  } while (true);
  ctx.fillText(name, BHASA_DIWAS_NAME_X, BHASA_DIWAS_NAME_Y);

  // Rank word into the patched gap, matching the surrounding printed
  // paragraph's own weight/size so it reads as part of the original text.
  ctx.font = BHASA_DIWAS_FONT('normal', 26);
  ctx.fillText(BHASA_DIWAS_RANK_LABEL[rank], BHASA_DIWAS_RANK_X, BHASA_DIWAS_RANK_Y);

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

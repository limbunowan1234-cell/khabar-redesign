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

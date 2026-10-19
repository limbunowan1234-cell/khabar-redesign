// Categories for the /apps store. The keys are also enforced by the Worker
// (cloudflare/src/routes/downloads.ts CATEGORIES) -- add a new one in both
// places, then it shows up here, on the public page, and in the admin and
// submit forms automatically.
export const DOWNLOAD_CATEGORIES = [
  { key: 'apps', label: 'Apps', emoji: '📱' },
  { key: 'games', label: 'Games', emoji: '🎮' },
  { key: 'magic-tricks', label: 'Magic Tricks', emoji: '🎩' },
  { key: 'game-materials', label: 'Game Materials', emoji: '🧩' },
] as const;

export type DownloadCategoryKey = (typeof DOWNLOAD_CATEGORIES)[number]['key'];

export type ListingStatus = 'pending' | 'approved' | 'rejected';

export interface DownloadItem {
  $id: string;
  slug: string | null;
  title: string;
  tagline: string | null;
  category: string;
  description: string | null;
  version: string | null;
  iconFileId: string | null;
  screenshots: string[];
  developerName: string | null;
  websiteUrl: string | null;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  featured: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  // Star ratings from app reviews; only filled in on the /downloads list.
  ratingCount?: number;
  ratingAverage?: number | null;
  hosted: boolean;
  hasDownload: boolean;
  createdAt: string;
  // Admin list / the submitter's own list only:
  status?: ListingStatus;
  rejectionReason?: string | null;
  active?: boolean;
  developerEmail?: string | null;
  // Admin list only:
  externalUrl?: string | null;
  fileKey?: string | null;
  submitterId?: string | null;
}

export const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Icons and screenshots are plain images in the shared bucket, served from
// the same /cdn/articles route article images use.
export function imageUrl(fileId: string | null | undefined): string {
  return fileId ? WORKER_URL + '/cdn/articles/' + fileId : '';
}

export function appHref(item: Pick<DownloadItem, 'slug' | '$id'>): string {
  return '/apps/' + (item.slug || item.$id);
}

export function downloadHref(item: Pick<DownloadItem, '$id'>): string {
  return WORKER_URL + '/downloads/' + item.$id + '/download';
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, '') + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1).replace(/\.0$/, '') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function categoryMeta(key: string) {
  return DOWNLOAD_CATEGORIES.find((c) => c.key === key) || { key, label: key, emoji: '📦' };
}

// What the card/button should say. A listing with a file or download link
// gets "Get"; one that's only a store or website page says where it goes.
export function primaryAction(item: DownloadItem): { label: string; href: string; external: boolean } | null {
  if (item.hasDownload) return { label: 'Get', href: downloadHref(item), external: !item.hosted };
  if (item.playStoreUrl) return { label: 'Play Store', href: item.playStoreUrl, external: true };
  if (item.appStoreUrl) return { label: 'App Store', href: item.appStoreUrl, external: true };
  if (item.websiteUrl) return { label: 'Open', href: item.websiteUrl, external: true };
  return null;
}

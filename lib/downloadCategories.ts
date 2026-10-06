// Categories for the /apps downloads section. The keys are also enforced by
// the Worker (cloudflare/src/routes/downloads.ts CATEGORIES) -- add a new
// one in both places, then it shows up here, on the public page, and in the
// admin form automatically.
export const DOWNLOAD_CATEGORIES = [
  { key: 'apps', label: 'Apps', emoji: '📱' },
  { key: 'games', label: 'Games', emoji: '🎮' },
  { key: 'magic-tricks', label: 'Magic Tricks', emoji: '🎩' },
  { key: 'game-materials', label: 'Game Materials', emoji: '🧩' },
] as const;

export type DownloadCategoryKey = (typeof DOWNLOAD_CATEGORIES)[number]['key'];

export interface DownloadItem {
  $id: string;
  title: string;
  category: string;
  description: string | null;
  version: string | null;
  iconFileId: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  downloadCount: number;
  hosted: boolean;
  createdAt: string;
  // Admin list only:
  active?: boolean;
  externalUrl?: string | null;
  fileKey?: string | null;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, '') + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1).replace(/\.0$/, '') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

export function categoryMeta(key: string) {
  return DOWNLOAD_CATEGORIES.find((c) => c.key === key) || { key, label: key, emoji: '📦' };
}

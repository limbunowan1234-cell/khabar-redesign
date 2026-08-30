// The Nepali Bhasa Diwas 2026 contest's single close date: submissions
// close, voting closes, and the winners tab/certificates open up all at
// the same moment. One shared constant so BhasaDivasHub.tsx (winners
// tab), SubmissionForm.tsx (submission gate), and SubmissionFeed.tsx
// (voting gate) never drift out of sync with each other.
export const BHASA_DIWAS_CLOSE_DATE = '2026-08-30T00:00:00+05:30';

export function isBhasaDiwasClosed(): boolean {
  return new Date() >= new Date(BHASA_DIWAS_CLOSE_DATE);
}

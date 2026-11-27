// Where "Get the app" links point.
//
// Google Play's closed test needs testers opted in for 14 days in a row
// before the app can go to production. Until TESTER_UNTIL, every app link
// sends readers to the tester Google Group (khabartester@googlegroups.com);
// after that it switches back to the Play Store page by itself.

export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.khabardarjeeling.app';
export const TESTER_GROUP_URL = 'https://groups.google.com/g/khabartester';
// After joining the group, testers opt in here, then install from Play.
export const TESTER_OPTIN_URL = 'https://play.google.com/apps/testing/com.khabardarjeeling.app';

// 14 days from 27 Nov 2026: last day is 10 Dec, links switch back at the
// start of 11 Dec 2026 (IST).
export const TESTER_UNTIL = new Date('2026-12-11T00:00:00+05:30');

export function isTesterPeriod(now: Date = new Date()): boolean {
  return now < TESTER_UNTIL;
}

export function appLink(now: Date = new Date()): string {
  return isTesterPeriod(now) ? TESTER_GROUP_URL : PLAY_URL;
}

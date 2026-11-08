// Dates where the generic tithi-window rule gives a different day than Drik Panchang (Darjeeling).
// Every entry was checked against https://www.drikpanchang.com/calendars/hindu/hinducalendar.html?year=YYYY&geoname-id=1273467
// Keep this list short: re-verify every generated year against Drik before publishing it.
export const OVERRIDES = {
  2026: {
    // Purnima begins inside the pradosh but under Bhadra (Vishti) all night, Drik moves Dahan to the next evening
    'holika-dahan': ['2026-03-03'],
  },
  2027: {
    'holika-dahan': ['2027-03-21'],
  },
};

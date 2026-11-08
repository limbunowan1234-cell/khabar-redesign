// Names and labels for the Patro, in English and Nepali (Devanagari).
export type Lang = 'en' | 'ne';
type Pair = [string, string]; // [en, ne]

export const WEEKDAYS: Pair[] = [
  ['Sunday', 'आइतबार'], ['Monday', 'सोमबार'], ['Tuesday', 'मंगलबार'], ['Wednesday', 'बुधबार'],
  ['Thursday', 'बिहीबार'], ['Friday', 'शुक्रबार'], ['Saturday', 'शनिबार'],
];
export const WEEKDAYS_SHORT: Pair[] = [
  ['Sun', 'आइत'], ['Mon', 'सोम'], ['Tue', 'मंगल'], ['Wed', 'बुध'], ['Thu', 'बिहि'], ['Fri', 'शुक्र'], ['Sat', 'शनि'],
];
export const GREG_MONTHS: Pair[] = [
  ['January', 'जनवरी'], ['February', 'फेब्रुअरी'], ['March', 'मार्च'], ['April', 'अप्रिल'], ['May', 'मे'], ['June', 'जुन'],
  ['July', 'जुलाई'], ['August', 'अगस्ट'], ['September', 'सेप्टेम्बर'], ['October', 'अक्टोबर'], ['November', 'नोभेम्बर'], ['December', 'डिसेम्बर'],
];
export const BS_MONTHS: Pair[] = [
  ['Baisakh', 'बैशाख'], ['Jestha', 'जेठ'], ['Ashadh', 'असार'], ['Shrawan', 'श्रावण'], ['Bhadra', 'भदौ'], ['Ashwin', 'असोज'],
  ['Kartik', 'कात्तिक'], ['Mangsir', 'मंसिर'], ['Poush', 'पौष'], ['Magh', 'माघ'], ['Falgun', 'फाल्गुन'], ['Chaitra', 'चैत्र'],
];
// amanta lunar months, index 0 = Chaitra
export const LUNAR_MONTHS: Pair[] = [
  ['Chaitra', 'चैत्र'], ['Vaishakha', 'वैशाख'], ['Jyeshtha', 'ज्येष्ठ'], ['Ashadha', 'आषाढ'], ['Shravana', 'श्रावण'], ['Bhadrapada', 'भाद्रपद'],
  ['Ashwin', 'आश्विन'], ['Kartik', 'कार्तिक'], ['Margashirsha', 'मार्गशीर्ष'], ['Pausha', 'पौष'], ['Magha', 'माघ'], ['Phalguna', 'फाल्गुन'],
];
const TITHI: Pair[] = [
  ['Pratipada', 'प्रतिपदा'], ['Dwitiya', 'द्वितीया'], ['Tritiya', 'तृतीया'], ['Chaturthi', 'चतुर्थी'], ['Panchami', 'पञ्चमी'],
  ['Shashthi', 'षष्ठी'], ['Saptami', 'सप्तमी'], ['Ashtami', 'अष्टमी'], ['Navami', 'नवमी'], ['Dashami', 'दशमी'],
  ['Ekadashi', 'एकादशी'], ['Dwadashi', 'द्वादशी'], ['Trayodashi', 'त्रयोदशी'], ['Chaturdashi', 'चतुर्दशी'],
];
export const NAKSHATRA: Pair[] = [
  ['Ashwini', 'अश्विनी'], ['Bharani', 'भरणी'], ['Krittika', 'कृत्तिका'], ['Rohini', 'रोहिणी'], ['Mrigashira', 'मृगशिरा'], ['Ardra', 'आर्द्रा'],
  ['Punarvasu', 'पुनर्वसु'], ['Pushya', 'पुष्य'], ['Ashlesha', 'आश्लेषा'], ['Magha', 'मघा'], ['Purva Phalguni', 'पूर्वाफाल्गुनी'],
  ['Uttara Phalguni', 'उत्तराफाल्गुनी'], ['Hasta', 'हस्त'], ['Chitra', 'चित्रा'], ['Swati', 'स्वाती'], ['Vishakha', 'विशाखा'],
  ['Anuradha', 'अनुराधा'], ['Jyeshtha', 'ज्येष्ठा'], ['Mula', 'मूल'], ['Purva Ashadha', 'पूर्वाषाढा'], ['Uttara Ashadha', 'उत्तराषाढा'],
  ['Shravana', 'श्रवण'], ['Dhanishta', 'धनिष्ठा'], ['Shatabhisha', 'शतभिषा'], ['Purva Bhadrapada', 'पूर्वाभाद्रपद'],
  ['Uttara Bhadrapada', 'उत्तराभाद्रपद'], ['Revati', 'रेवती'],
];
export const YOGA: Pair[] = [
  ['Vishkambha', 'विष्कम्भ'], ['Priti', 'प्रीति'], ['Ayushman', 'आयुष्मान्'], ['Saubhagya', 'सौभाग्य'], ['Shobhana', 'शोभन'],
  ['Atiganda', 'अतिगण्ड'], ['Sukarma', 'सुकर्मा'], ['Dhriti', 'धृति'], ['Shula', 'शूल'], ['Ganda', 'गण्ड'], ['Vriddhi', 'वृद्धि'],
  ['Dhruva', 'ध्रुव'], ['Vyaghata', 'व्याघात'], ['Harshana', 'हर्षण'], ['Vajra', 'वज्र'], ['Siddhi', 'सिद्धि'], ['Vyatipata', 'व्यतिपात'],
  ['Variyana', 'वरीयान्'], ['Parigha', 'परिघ'], ['Shiva', 'शिव'], ['Siddha', 'सिद्ध'], ['Sadhya', 'साध्य'], ['Shubha', 'शुभ'],
  ['Shukla', 'शुक्ल'], ['Brahma', 'ब्रह्म'], ['Indra', 'इन्द्र'], ['Vaidhriti', 'वैधृति'],
];
const KARANA_REPEAT: Pair[] = [
  ['Bava', 'बव'], ['Balava', 'बालव'], ['Kaulava', 'कौलव'], ['Taitila', 'तैतिल'], ['Gara', 'गर'], ['Vanija', 'वणिज'], ['Vishti (Bhadra)', 'विष्टि (भद्रा)'],
];
const KARANA_FIXED: Pair[] = [['Shakuni', 'शकुनि'], ['Chatushpada', 'चतुष्पाद'], ['Naga', 'नाग']];

export const pick = (p: Pair, lang: Lang) => (lang === 'ne' ? p[1] : p[0]);

export function tithiName(idx: number, lang: Lang, withPaksha = true): string {
  if (idx === 14) return lang === 'ne' ? 'पूर्णिमा' : 'Purnima';
  if (idx === 29) return lang === 'ne' ? 'औंसी (अमावस्या)' : 'Amavasya';
  const base = pick(TITHI[idx % 15], lang);
  if (!withPaksha) return base;
  const paksha = idx < 15 ? (lang === 'ne' ? 'शुक्ल' : 'Shukla') : (lang === 'ne' ? 'कृष्ण' : 'Krishna');
  return `${paksha} ${base}`;
}
export function karanaName(idx: number, lang: Lang): string {
  if (idx === 0) return lang === 'ne' ? 'किंस्तुघ्न' : 'Kimstughna';
  if (idx >= 57) return pick(KARANA_FIXED[idx - 57], lang);
  return pick(KARANA_REPEAT[(idx - 1) % 7], lang);
}

// ---------- digits & time ----------
const DEV = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const num = (n: number | string, lang: Lang) =>
  lang === 'ne' ? String(n).replace(/\d/g, (d) => DEV[+d]) : String(n);

/** minutes since local (IST) midnight -> "5:52 AM", with a day marker when past midnight */
export function clock(min: number | null | undefined, lang: Lang): string {
  if (min == null) return '—';
  const dayOff = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const text = `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
  const out = lang === 'ne' ? num(text, lang) : text;
  if (!dayOff) return out;
  return `${out} ${dayOff > 0 ? (lang === 'ne' ? '(भोलिपल्ट)' : '(next day)') : (lang === 'ne' ? '(अघिल्लो दिन)' : '(prev day)')}`;
}
export const range = (r: [number, number] | null, lang: Lang) => (r ? `${clock(r[0], lang)} – ${clock(r[1], lang)}` : '—');

// ---------- festivals ----------
export interface FestivalInfo { en: string; ne: string; holiday?: boolean }
export const FESTIVALS: Record<string, FestivalInfo> = {
  'new-year': { en: "New Year's Day", ne: 'अंग्रेजी नयाँ वर्ष', holiday: true },
  'makar-sankranti': { en: 'Makar Sankranti (Maghe Sankranti)', ne: 'मकर संक्रान्ति (माघे संक्रान्ति)' },
  'basant-panchami': { en: 'Vasant Panchami (Saraswati Puja)', ne: 'बसन्त पञ्चमी (सरस्वती पूजा)' },
  'netaji-jayanti': { en: 'Netaji Subhas Chandra Bose Jayanti', ne: 'नेताजी जयन्ती' },
  'republic-day': { en: 'Republic Day', ne: 'गणतन्त्र दिवस', holiday: true },
  'maha-shivaratri': { en: 'Maha Shivaratri', ne: 'महाशिवरात्री' },
  'holika-dahan': { en: 'Holika Dahan', ne: 'होलिका दहन' },
  holi: { en: 'Holi (Fagu)', ne: 'होली (फागु)' },
  'ram-navami': { en: 'Ram Navami', ne: 'रामनवमी' },
  'hanuman-jayanti': { en: 'Hanuman Jayanti', ne: 'हनुमान जयन्ती' },
  'good-friday': { en: 'Good Friday', ne: 'गुड फ्राइडे', holiday: true },
  easter: { en: 'Easter Sunday', ne: 'इस्टर सन्डे' },
  'nepali-new-year': { en: 'Nepali New Year (Baisakh 1)', ne: 'नयाँ वर्ष (वैशाख १)' },
  'akshaya-tritiya': { en: 'Akshaya Tritiya', ne: 'अक्षय तृतीया' },
  'buddha-purnima': { en: 'Buddha Purnima', ne: 'बुद्ध पूर्णिमा', holiday: true },
  'labour-day': { en: 'May Day (Labour Day)', ne: 'मजदुर दिवस', holiday: true },
  'rath-yatra': { en: 'Rath Yatra', ne: 'रथयात्रा' },
  'guru-purnima': { en: 'Guru Purnima', ne: 'गुरु पूर्णिमा' },
  'nag-panchami': { en: 'Nag Panchami', ne: 'नाग पञ्चमी' },
  'janai-purnima': { en: 'Janai Purnima (Raksha Bandhan)', ne: 'जनै पूर्णिमा (रक्षाबन्धन)' },
  janmashtami: { en: 'Krishna Janmashtami', ne: 'कृष्ण जन्माष्टमी' },
  'independence-day': { en: 'Independence Day', ne: 'स्वतन्त्रता दिवस', holiday: true },
  'haritalika-teej': { en: 'Haritalika Teej', ne: 'हरितालिका तीज' },
  'ganesh-chaturthi': { en: 'Ganesh Chaturthi', ne: 'गणेश चतुर्थी' },
  'gandhi-jayanti': { en: 'Gandhi Jayanti', ne: 'गान्धी जयन्ती', holiday: true },
  ghatasthapana: { en: 'Ghatasthapana (Navratri begins)', ne: 'घटस्थापना (दशैं सुरु)' },
  fulpati: { en: 'Fulpati', ne: 'फूलपाती' },
  'maha-ashtami': { en: 'Maha Ashtami', ne: 'महाअष्टमी' },
  'maha-navami': { en: 'Maha Navami', ne: 'महानवमी' },
  'vijaya-dashami': { en: 'Vijaya Dashami (Dussehra)', ne: 'विजया दशमी (दशैं)', holiday: true },
  'kojagrat-purnima': { en: 'Kojagrat (Sharad) Purnima', ne: 'कोजाग्रत पूर्णिमा' },
  dhanteras: { en: 'Dhanteras', ne: 'धनतेरस' },
  'naraka-chaturdashi': { en: 'Naraka Chaturdashi (Choti Diwali)', ne: 'नरक चतुर्दशी' },
  diwali: { en: 'Diwali (Lakshmi Puja)', ne: 'दीपावली (लक्ष्मी पूजा)', holiday: true },
  'govardhan-puja': { en: 'Govardhan Puja', ne: 'गोवर्धन पूजा' },
  'bhai-dooj': { en: 'Bhai Dooj (Bhai Tika)', ne: 'भाइटीका (भाइ दूज)' },
  'chhath-puja': { en: 'Chhath Puja', ne: 'छठ पूजा' },
  'kartik-purnima': { en: 'Kartik Purnima', ne: 'कार्तिक पूर्णिमा' },
  christmas: { en: 'Christmas', ne: 'क्रिसमस', holiday: true },
};
export const festivalName = (id: string, lang: Lang) => {
  const f = FESTIVALS[id];
  return f ? (lang === 'ne' ? f.ne : f.en) : id;
};

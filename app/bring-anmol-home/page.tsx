import AppealClient from './AppealClient';

export const metadata = {
  title: 'Bring Anmol Home — अनमोललाई घर फर्काउने अभियान',
  description: 'Anmol Sinchury from Phagadi, Mirik is trapped in a scam company on the Thailand–Myanmar border and has been beaten and tortured. Help bring him home safely.',
  alternates: { canonical: 'https://khabardarjeeling.in/bring-anmol-home' },
  openGraph: {
    title: 'अनमोललाई घर फर्काऔँ | Bring Anmol Home',
    description: 'मिरिकका अनमोल सिन्चौरी थाइल्याण्ड–म्यानमार सीमाको स्क्याम कम्पनीमा फसेका छन्। सुरक्षित घर फर्काउन सहयोग गरौँ।',
    images: [{ url: 'https://khabardarjeeling.in/assets/fundraiser/anmol/anmol-appeal.jpg', width: 1080, height: 1350 }],
  },
};

export default function BringAnmolHomePage() {
  return <AppealClient />;
}

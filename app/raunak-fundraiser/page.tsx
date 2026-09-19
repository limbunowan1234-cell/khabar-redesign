import FundraiserClient from './FundraiserClient';

export const metadata = {
  title: "Help Save Raunak — Fundraiser",
  description: "Raunak Chettri, a 2-year-old from Kalimpong, is fighting a rare brain tumour at CMC Vellore. Help support his treatment.",
  alternates: { canonical: 'https://khabardarjeeling.in/raunak-fundraiser' },
  openGraph: {
    title: "Help Save 2-Year-Old Raunak — Fighting Brain Cancer at CMC Vellore",
    description: "Every share and every rupee brings him closer to the treatment he needs.",
  },
};

export default function RaunakFundraiserPage() {
  return <FundraiserClient />;
}

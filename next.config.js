/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/article/news-mr93qu4x247', destination: '/article/लिभिङ-आउट-लाउड-युथ-परिवारले-सुकेपोखरीमा-मनायो-फिफा-विश्वकप-२-428b88', permanent: true },
      { source: '/article/news-mr93r7vv723', destination: '/article/दार्जिलिंग-हिमालय-की-गोद-में-बसा-खूबसूरत-पर्यटन-स्थल-77c728', permanent: true },
      { source: '/article/news-mr93r8r6593', destination: '/article/दार्जिलिंग-में-पर्यटन-को-बढ़ावा-सड़क-परियोजनाओं-में-तेजी-और-b8ff55', permanent: true },
      { source: '/article/news-mr93r9jm599', destination: '/article/सिलीगुड़ी-में-विकास-को-मिली-नई-रफ्तार-रेलवे-परियोजनाओं-और-जन-1720d7', permanent: true },
      { source: '/article/news-mr93ranf154', destination: '/article/सिलीगुड़ी-में-व्यापार-और-उद्योग-को-मिल-रही-नई-गति-निवेश-के-ब-63fda8', permanent: true },
      { source: '/article/news-mr93rbip137', destination: '/article/दार्जिलिंग-राजनीति-में-फिर-गरमाया-माहौल-स्थायी-समाधान-और-युव-9c51cb', permanent: true },
      { source: '/article/news-mr93s4q3450', destination: '/article/नयाँ-उज्यालोको-पर्खाइ-b3e920', permanent: true },
      { source: '/article/news-mr93scw58', destination: '/article/म-दार्जिलिङ-पहाड-की-रानी-अनि-मेरो-कथा-a76097', permanent: true },
      { source: '/article/news-mrdfilj4', destination: '/article/अन्तिम-रेफरको-चिठी-0cc5d5', permanent: true },
      { source: '/article/news-mrf1yd19', destination: '/article/आशाले-सजिएको-दार्जिलिङ-e963b4', permanent: true },
      { source: '/article/news-mrk8q6o1', destination: '/article/निर्वाचनपछि-दार्जिलिङको-जीवन-8c45e5', permanent: true },
      { source: '/article/news-mrnj0lcu', destination: '/article/परिवर्तनको-लहर-dd8419', permanent: true },
      { source: '/article/news-mrte20rz', destination: '/article/चुनाव-पश्चात-दार्जिलिङ-c78509', permanent: true },
      { source: '/article/news-mryq9uqf', destination: '/article/एक्लो-गाउँ-र-रहरहरू-धेरै-छन्-bf457e', permanent: true },
      { source: '/article/news-mryt9by7', destination: '/article/किन-गर्छौ-अभिमान-72e0f9', permanent: true },
      { source: '/article/news-mrz6plni', destination: '/article/परिवर्तनको-प्रतीक्षा-b0176f', permanent: true },
      { source: '/article/news-mrz7bt8e', destination: '/article/हाम्रो-मातृभाषा-0c8d94', permanent: true },
      { source: '/article/news-mrz7y2xf', destination: '/article/जन्तर-मन्तरमा-न्यायको-आवाज-0d4d6c', permanent: true },
      { source: '/article/news-mrzrf07x', destination: '/article/एक-प्रतिशत-ब्याट्री-f602cf', permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.khabardarjeeling.in',
        pathname: '/v1/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'api.khabardarjeeling.space',
        pathname: '/v1/storage/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/**',
      },
    ],
  },
};
module.exports = nextConfig;
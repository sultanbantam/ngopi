const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(target, 'utf8');
const title = 'Ngopi — ngobrol paling intim';
const description = 'Daftar tanpa nomor HP/email. Nikmati chat aman, voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis.';
const image = 'https://ngopi.top/ngopi-share-v3.jpg';
html = html.replace(/<title>[\s\S]*?<\/title>/i, '')
  .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '');
const tags = `
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ngopi">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://ngopi.top">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1000">
<meta property="og:image:height" content="1000">
<meta property="og:image:alt" content="Ngopi — ngobrol paling intim">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
`;
if (!html.includes('</head>')) throw new Error('Exported HTML has no head element');
fs.writeFileSync(target, html.replace('</head>', tags + '</head>'));
console.log('Ngopi social preview metadata added.');

import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Ngopi — Ngobrol Paling Intim</title>
        <meta name="description" content="Chat aman tanpa nomor HP/email. Bisa voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis." />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.bamboochat.click/" />
        <meta property="og:title" content="Ngopi — Ngobrol Paling Intim" />
        <meta property="og:description" content="Chat aman tanpa nomor HP/email. Bisa voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis." />
        <meta property="og:image" content="https://www.bamboochat.click/assets/icon.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://www.bamboochat.click/" />
        <meta property="twitter:title" content="Ngopi — Ngobrol Paling Intim" />
        <meta property="twitter:description" content="Chat aman tanpa nomor HP/email. Bisa voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis." />
        <meta property="twitter:image" content="https://www.bamboochat.click/assets/icon.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KolamPintar — Manajemen Air Kolam Ikan",
  description:
    "Pemantauan kualitas air real-time dan kontrol kapur berbasis pH untuk kolam budidaya ikan",
  icons: {
    icon: "/logo-pict.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

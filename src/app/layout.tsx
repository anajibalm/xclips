import type { Metadata } from "next";
import ThemeRegistry from "@/lib/ThemeRegistry";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "xClips — AI Shorts & Video Clipper Studio",
  description: "Smart Long-to-Shorts Video Clipper Engine & AI Highlight Studio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@400;700;900&family=Poppins:wght@400;700;900&family=Roboto:wght@400;700;900&family=Outfit:wght@400;700;900&family=Anton&family=Bebas+Neue&family=Syne:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#09090b", color: "#f4f4f5" }}>
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}


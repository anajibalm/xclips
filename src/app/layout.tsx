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
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#09090b", color: "#f4f4f5" }}>
        <ThemeRegistry>
          <AppShell>{children}</AppShell>
        </ThemeRegistry>
      </body>
    </html>
  );
}


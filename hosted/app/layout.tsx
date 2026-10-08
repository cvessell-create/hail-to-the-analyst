import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hail to the Analyst",
  description: "Room-code cooperative FPS and Vessell game theory.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

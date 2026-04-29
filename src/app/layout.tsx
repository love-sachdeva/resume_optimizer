import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ThankYouLove",
  description:
    "Upload your resume and a job description, get a believable ATS score, and produce a sharper version without inventing facts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

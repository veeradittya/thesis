import type { Metadata } from "next";
import { Inter, Geist_Mono, EB_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
// Elegant serif for the Monaco-style logo wordmark.
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Thesis",
  description: "The WHOOP for your portfolio — we watch the world and tell you when your thesis breaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${geistMono.variable} ${ebGaramond.variable} h-full`}>
      <body className="min-h-full antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

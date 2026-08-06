import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "DSA Tracker — structured interview prep",
    template: "%s · DSA Tracker",
  },
  description:
    "Track 300+ curated DSA problems by topic and by pattern. Spaced-repetition revision, notes, a solve heatmap and LeetCode sync.",
  openGraph: {
    title: "DSA Tracker",
    description: "Track 300+ curated DSA problems by topic and by pattern.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#16181f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--surface)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

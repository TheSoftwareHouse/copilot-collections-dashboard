import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Copilot Usage Dashboard",
  description: "GitHub Copilot usage monitoring and analytics dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <div className="flex-1">{children}</div>
          <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-200">
            Built with{" "}
            <a
              href="https://github.com/TheSoftwareHouse/copilot-collections"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Copilot Collections
            </a>{" "}
            by{" "}
            <a
              href="https://tsh.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              The Software House
            </a>{" "}
            &copy; 2026.
          </footer>
        </Providers>
      </body>
    </html>
  );
}

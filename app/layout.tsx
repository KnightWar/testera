import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    template: "%s | Testera",
    default: "Testera — Proctored Exam Platform",
  },
  description:
    "Testera is a secure, proctored online examination platform for SoCSE. Supports MCQ and subjective questions with real-time proctoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#0A0B14] text-white antialiased">
        {children}
      </body>
    </html>
  );
}

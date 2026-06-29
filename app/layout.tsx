import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Prav-AI",
    default: "Prav-AI — Proctored Exam Platform",
  },
  description:
    "Prav-AI is a secure, proctored online examination platform for SoCSE. Supports MCQ and subjective questions with real-time proctoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener("error", function(e) {
                if (e.message && (
                  e.message.indexOf("ChunkLoadError") !== -1 ||
                  e.message.indexOf("Failed to load chunk") !== -1 ||
                  e.message.indexOf("loading chunk") !== -1
                )) {
                  console.warn("ChunkLoadError caught, reloading...");
                  window.location.reload();
                }
              }, true);

              window.addEventListener("pageshow", function(e) {
                if (e.persisted) {
                  window.location.reload();
                }
              });
            `
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

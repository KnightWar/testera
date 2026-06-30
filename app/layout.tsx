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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=IBM+Plex+Mono:ital,wght@0,100..700;1,100..700&display=swap"
          rel="stylesheet"
        />
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

              try {
                const navEntry = performance.getEntriesByType("navigation")[0];
                if (navEntry && navEntry.type === "back_forward") {
                  window.location.reload();
                }
              } catch (err) {}
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

// app/layout.tsx
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";

export const metadata: Metadata = {
    title: "BinBird",
    description: "Bin management made simple",
    icons: {
    icon: [
      { url: "/wing-favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/wing-icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: {
      url: "/wing-apple-touch-icon.png",
      type: "image/png",
      sizes: "180x180",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden bg-black text-white">
        <MapSettingsProvider>
          <div className="flex flex-col min-h-screen">
            {children}
          </div>
        </MapSettingsProvider>
      </body>
    </html>
  );
}

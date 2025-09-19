// app/layout.tsx
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";

export const metadata: Metadata = {
  title: "BinBird",
  description: "Bin management made simple",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-black text-white antialiased">
        <MapSettingsProvider>
          <div className="relative h-screen">
            {children}
          </div>
        </MapSettingsProvider>
      </body>
    </html>
  );
}

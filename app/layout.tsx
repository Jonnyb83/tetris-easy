import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ion Stack",
  description: "Skladaj padajúce ióny a spúšťaj farebné reťazové reakcie.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}

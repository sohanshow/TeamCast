import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamCast - NFL Play Video Generator",
  description: "Generate AI-powered video simulations from NFL tracking data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

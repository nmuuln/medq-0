import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Анги Платформ - Сургалтын Систем",
  description: "Багш сурагчийн харилцаа холбоог хялбаршуулсан орчин үеийн сургалтын систем",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      style={{ colorScheme:"light" }}
    >
      <body style={{ height:"100vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>{children}</body>
    </html>
  );
}

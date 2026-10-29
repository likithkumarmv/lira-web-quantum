import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "LIRA — Maritime Terminal Operating System v7.0",
  description: "Logistics Intelligence & Recovery Automation — Freight Exception Resolution Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var theme = localStorage.getItem('theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            })()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[#F3F4F6] dark:bg-[#090B0E] text-[#111827] dark:text-[#F0F4F8] flex flex-col antialiased">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-5 bg-[#F3F4F6] dark:bg-[#090B0E]">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

import React from 'react';
import './globals.css';
import { LanguageProvider } from '@/context/LanguageContext';
import { Inter } from 'next/font/google';
import { zh } from '@/i18n/zh';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  // Default (zh) metadata for SSR / crawlers. The client-side LanguageProvider
  // updates document.title + meta description when the user switches language.
  title: zh.meta_title,
  description: zh.meta_description,
  keywords: zh.meta_keywords,
  authors: [{ name: 'CT Physics Team' }],
  openGraph: {
    title: zh.meta_title,
    description: zh.meta_description,
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // maximum-scale and user-scalable are removed for accessibility compliance
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${inter.variable} font-sans`}>
      <body className="antialiased bg-black text-text-100 dark:bg-black dark:text-white">
        {/* Set <html lang> from the saved preference before hydration (avoids a wrong-language flicker). */}
        <script dangerouslySetInnerHTML={{ __html: "try { var l = localStorage.getItem('pref-lang'); if (l === 'en' || l === 'zh') document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN'; } catch(e) {}" }} />
        <script dangerouslySetInnerHTML={{ __html: "try { const style = localStorage.getItem('pref-theme-style') || 'glass'; document.documentElement.classList.add('theme-' + style); } catch(e) {}" }} />

        <LanguageProvider>
          {children}
        </LanguageProvider>

        {/* Global keyboard shortcut handler */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('keydown', function(e) {
                // Ctrl/Cmd + K for search
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                  e.preventDefault();
                  // Trigger search modal
                }
                // ? for help
                if (e.key === '?' && !e.target.matches('input, textarea')) {
                  e.preventDefault();
                  // Show keyboard shortcuts
                }
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
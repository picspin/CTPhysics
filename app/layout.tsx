import React from 'react';
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'CT物理原理交互式学习平台',
  description: '用于理解CT物理原理的高级交互式模拟和可视化教学工具',
  keywords: 'CT physics, medical imaging, radiology, interactive learning, simulations, CT物理, 医学影像, 放射学',
  authors: [{ name: 'CT Physics Team' }],
  openGraph: {
    title: 'CT物理原理交互式学习平台',
    description: '用于理解CT物理原理的高级交互式模拟和可视化教学工具',
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
    <html lang="zh-CN" className={`${inter.variable} font-sans`}>
      <body className="antialiased bg-black text-text-100 dark:bg-black dark:text-white">
        {children}

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
import React from 'react';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'CT Physics Interactive Learning Platform',
  description: 'Advanced interactive simulations and visualizations for understanding CT physics principles',
  keywords: 'CT physics, medical imaging, radiology, interactive learning, simulations',
  authors: [{ name: 'CT Physics Team' }],
  openGraph: {
    title: 'CT Physics Interactive Learning Platform',
    description: 'Advanced interactive simulations and visualizations for understanding CT physics principles',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <body className="antialiased bg-bg-200 text-text-100">
        <div className="flex min-h-screen">
          <Sidebar />
          
          <div className="flex-1 md:ml-64 flex flex-col">
            <Header />
            
            <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
            
            <footer className="mt-auto border-t border-border-100 bg-bg-100/50 backdrop-blur-sm">
              <div className="px-4 py-6 md:px-6 lg:px-8">
                <div className="mx-auto max-w-7xl">
                  <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                    <div className="text-sm text-text-200">
                      © {new Date().getFullYear()} CT Physics Interactive Learning Platform
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <a href="/privacy" className="text-text-200 hover:text-primary-100 transition-colors">
                        Privacy Policy
                      </a>
                      <a href="/terms" className="text-text-200 hover:text-primary-100 transition-colors">
                        Terms of Use
                      </a>
                      <a href="/about" className="text-text-200 hover:text-primary-100 transition-colors">
                        About
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
        
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
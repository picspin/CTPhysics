import React from 'react';
import './globals.css'; // Import global styles
import Sidebar from '../Sidebar';
import Header from '../Header';
import { Inter } from 'next/font/google';

// 使用Inter字体
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'CT Physics Web App',
  description: 'Interactive simulations for CT physics principles',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
<<<<<<< HEAD
        <div className="flex min-h-screen flex-col bg-200">
=======
        <div className="flex min-h-screen flex-col bg-bg-200">
>>>>>>> 5cc269c7d7bb3e0f9bea78d37883bea822dffc4c
          <Sidebar />
          <div className="flex w-full flex-col transition-all duration-300 md:pl-64">
            <Header />
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              <div className="mx-auto max-w-6xl animate-fadeIn">
                {children}
              </div>
            </main>
            <footer className="border-t border-border-100 bg-bg-100/80 p-4 text-center text-sm text-text-200 backdrop-blur-sm md:p-6">
              <p>© {new Date().getFullYear()} CT Physics Web App</p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}

'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { path: '/reconstruction', label: 'CT重建和螺旋CT' },
  { path: '/dose', label: 'CT剂量测量' },
  { path: '/cardiac', label: '心脏CT' },
  { path: '/dual-energy', label: '束硬化和双能CT' },
  { path: '/questions', label: 'CT物理复习题' },
];

const Header = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleNavClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border-100 bg-bg-100/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="md:hidden">
          <Link href="/" className="text-xl font-bold text-primary-100 focus-ring">
            CT Physics
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <span className="hidden text-sm text-text-200 sm:block">交互式CT物理学习平台</span>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="rounded-full bg-bg-300 p-2 text-text-200 transition-colors hover:bg-primary-100/10 hover:text-primary-100 focus-ring"
            aria-label="GitHub 仓库"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
<<<<<<< HEAD
            className="flex h-10 w-10 items-center justify-center rounded-xl p-2 text-text-100 transition-colors hover:bg-200/70 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100/50"
=======
            className="flex h-10 w-10 items-center justify-center rounded-xl p-2 text-text-100 transition-colors hover:bg-bg-200/70 hover:text-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100/50"
>>>>>>> 5cc269c7d7bb3e0f9bea78d37883bea822dffc4c
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <nav className="animate-slide-up border-t border-border-100/20 bg-bg-100/95 px-4 py-3 backdrop-blur-sm">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`block rounded-xl px-4 py-3 text-base font-medium transition-all duration-300 ${
                    pathname === item.path
                      ? 'bg-primary-100/10 text-primary-100 shadow-sm'
<<<<<<< HEAD
                      : 'hover:bg-200/70 text-text-100 hover:text-primary-100'
=======
                      : 'hover:bg-bg-200/70 text-text-100 hover:text-primary-100'
>>>>>>> 5cc269c7d7bb3e0f9bea78d37883bea822dffc4c
                  }`}
                  onClick={handleNavClick}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
};

export default Header;

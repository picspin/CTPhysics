'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

const Header: React.FC = () => {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();
  
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>('dark');

  // Page titles mapping with translation
  const pageTitles: Record<string, string> = {
    '/': 'title',
    '/reconstruction': 'reconstruction',
    '/dose': 'dose',
    '/cardiac': 'cardiac',
    '/dual-energy': 'dual_energy',
    '/questions': 'practice',
    '/pcct': 'pcct',
  };

  const titleKey = pageTitles[pathname] || '';
  const currentTitle = titleKey ? t(titleKey) : 'CT Physics';

  useEffect(() => {
    // Sync Theme on load
    const savedTheme = localStorage.getItem('pref-theme') as 'dark' | 'light' | 'system' || 'dark';
    setThemeState(savedTheme);
    applyTheme(savedTheme);

    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);

      // Calculate scroll progress
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight - windowHeight;
      const scrollTop = window.scrollY;
      const scrollProgress = documentHeight > 0 ? (scrollTop / documentHeight) * 100 : 0;
      setProgress(scrollProgress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const applyTheme = (newTheme: 'dark' | 'light' | 'system') => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    }
  };

  const changeTheme = (newTheme: 'dark' | 'light' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('pref-theme', newTheme);
    applyTheme(newTheme);
  };

  return (
    <>
      <motion.header
        className={`
          relative z-30 transition-all duration-300
          bg-black/40 dark:bg-black/40 backdrop-blur-md border-b border-white/5 shadow-sm
        `}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Page title with animation */}
            <motion.div
              key={pathname + language}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              <h2 className="text-sm md:text-base lg:text-lg font-semibold text-text-100 dark:text-white">
                {currentTitle}
              </h2>
            </motion.div>

            {/* Action buttons */}
            <div className="flex items-center space-x-3">
              {/* GitHub repository link */}
              <a
                href="https://github.com/picspin/ctphysics"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 transition-colors duration-200"
                title={t('github')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24" className="text-text-200 dark:text-gray-300">
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386C24 5.373 18.627 0 12 0z"/>
                </svg>
              </a>

              {/* Settings button */}
              <motion.button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-white/5 dark:hover:bg-white/5 transition-colors duration-200"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={t('settings')}
              >
                <svg className="w-5 h-5 text-text-200 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/80"
          style={{ width: `${progress}%` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
        />
      </motion.header>

      {/* Floating action button for mobile */}
      <AnimatePresence>
        {scrolled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 p-3 bg-emerald-500 text-white rounded-full shadow-lg md:hidden"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Settings Modal (Popup Popup) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 overflow-hidden z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">{t('settings')}</h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Language Settings */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('language')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLanguage('zh')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        language === 'zh'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800/40 border-transparent text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      简体中文
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        language === 'en'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-800/40 border-transparent text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Theme Settings */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{t('theme')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['dark', 'light', 'system'] as const).map((tMode) => (
                      <button
                        key={tMode}
                        onClick={() => changeTheme(tMode)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border capitalize transition-all ${
                          theme === tMode
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-zinc-800/40 border-transparent text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {t(tMode)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-900/20"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;

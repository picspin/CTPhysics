'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'zh' | 'en';

type Translations = Record<string, string>;

const dict: Record<Language, Translations> = {
  zh: {
    title: 'CT物理原理交互式学习平台',
    overview: '概览 (Overview)',
    subtitle: '用于理解CT物理原理的高级交互式模拟和可视化教学工具',
    reconstruction: 'CT重建与螺旋CT',
    pcct: '光子计数CT (PCCT)',
    dose: '剂量与安全',
    cardiac: '心脏CT',
    dual_energy: '双能CT',
    practice: '复习与练习',
    github: 'GitHub 仓库',
    settings: '设置',
    theme: '主题',
    language: '语言',
    dark: '深色',
    light: '浅色',
    system: '系统',
    close: '关闭',
  },
  en: {
    title: 'CT Physics Interactive Learning Platform',
    overview: 'Overview',
    subtitle: 'Advanced interactive simulation and visualization tools for understanding CT physics.',
    reconstruction: 'CT Reconstruction & Helical CT',
    pcct: 'Photon-Counting CT (PCCT)',
    dose: 'Dose & Safety',
    cardiac: 'Cardiac CT',
    dual_energy: 'Dual Energy CT',
    practice: 'Practice & Quiz',
    github: 'GitHub Repo',
    settings: 'Settings',
    theme: 'Theme',
    language: 'Language',
    dark: 'Dark',
    light: 'Light',
    system: 'System',
    close: 'Close',
  }
};

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const saved = localStorage.getItem('pref-lang') as Language;
    if (saved === 'zh' || saved === 'en') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('pref-lang', lang);
  };

  const t = (key: string) => {
    return dict[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

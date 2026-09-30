'use client';

import React from 'react';
import PCCTSimulator from '@/components/simulators/PCCTSimulator';
import PageHeader from '@/components/ui/PageHeader';
import KeyPoints from '@/components/ui/KeyPoints';
import { useLanguage } from '@/context/LanguageContext';

export default function PCCTPage() {
  const { t } = useLanguage();
  const keyPoints = [t('pcct_kp1'), t('pcct_kp2'), t('pcct_kp3'), t('pcct_kp4')];

  return (
    <div className='space-y-6 max-w-7xl mx-auto px-4 py-6'>
      <PageHeader
        title={t('pcct_page_title')}
        description={t('pcct_page_desc')}
      />
      <KeyPoints points={keyPoints} />
      <PCCTSimulator />
    </div>
  );
}

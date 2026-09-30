'use client';

import React from 'react';
import SectionCard from '@/components/ui/SectionCard';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';

interface AppCard {
  id: string;
  title: MessageKey;
  tag: MessageKey;
  points: MessageKey[];
  limit: MessageKey;
  accent: string;
}

const THERAPY_CARDS: AppCard[] = [
  { id: 'dsa', title: 'cbct_app_dsa_title', tag: 'cbct_app_dsa_tag', points: ['cbct_app_dsa_1', 'cbct_app_dsa_2', 'cbct_app_dsa_3'], limit: 'cbct_app_dsa_limit', accent: 'border-primary-100' },
  { id: 'carm', title: 'cbct_app_carm_title', tag: 'cbct_app_carm_tag', points: ['cbct_app_carm_1', 'cbct_app_carm_2', 'cbct_app_carm_3'], limit: 'cbct_app_carm_limit', accent: 'border-accent-100' },
  { id: 'igrt', title: 'cbct_app_igrt_title', tag: 'cbct_app_igrt_tag', points: ['cbct_app_igrt_1', 'cbct_app_igrt_2', 'cbct_app_igrt_3'], limit: 'cbct_app_igrt_limit', accent: 'border-sky-400' },
];
const CONTRAST_CARDS: AppCard[] = [
  { id: 'dental', title: 'cbct_app_dental_title', tag: 'cbct_app_dental_tag', points: ['cbct_app_dental_1', 'cbct_app_dental_2', 'cbct_app_dental_3'], limit: 'cbct_app_dental_limit', accent: 'border-emerald-400' },
];

const Card: React.FC<{ card: AppCard }> = ({ card }) => {
  const { t } = useLanguage();
  return (
    <article className={`rounded-lg bg-bg-200 p-4 border-l-4 ${card.accent} space-y-2`} data-testid={`cbct-app-${card.id}`}>
      <h5 className="font-semibold text-text-100">{t(card.title)}</h5>
      <p className="text-xs uppercase tracking-wide text-text-300">{t(card.tag)}</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-text-200">
        {card.points.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
      <p className="text-xs text-text-300">{t(card.limit)}</p>
    </article>
  );
};

/** Common CBCT applications (bilingual cards) + a short DSA-principle box. */
const CBCTApplications: React.FC = () => {
  const { t } = useLanguage();
  return (
    <SectionCard title={t('cbct_app_title')}>
      <div className="space-y-6 text-text-200">
        <p>{t('cbct_app_intro')}</p>

        <h4 className="text-lg font-semibold text-text-100">{t('cbct_app_group_therapy')}</h4>
        <div className="bg-bg-300 p-4 rounded-lg text-sm border-l-4 border-primary-100 space-y-2" data-testid="cbct-dsa-principle">
          <h5 className="font-semibold text-text-100">{t('cbct_dsa_box_t')}</h5>
          <p>{t('cbct_dsa_box_1')}</p>
          <p className="font-mono text-text-100 overflow-x-auto whitespace-nowrap">{t('cbct_dsa_box_formula')}</p>
          <p>{t('cbct_dsa_box_2')}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {THERAPY_CARDS.map((c) => (
            <Card key={c.id} card={c} />
          ))}
        </div>

        <h4 className="text-lg font-semibold text-text-100">{t('cbct_app_group_contrast')}</h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CONTRAST_CARDS.map((c) => (
            <Card key={c.id} card={c} />
          ))}
        </div>

        <div className="text-sm bg-bg-300 p-4 rounded-lg border-l-4 border-accent-100">{t('cbct_app_common_note')}</div>
      </div>
    </SectionCard>
  );
};

export default CBCTApplications;

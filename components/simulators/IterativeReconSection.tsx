'use client';

import React from 'react';
import SectionCard from '@/components/ui/SectionCard';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import IterativeReconSimulator from './IterativeReconSimulator';
import { useLanguage } from '@/context/LanguageContext';

/** Iterative reconstruction (IR) explanation + demo, and a text-only deep-learning reconstruction supplement. */
const IterativeReconSection: React.FC = () => {
  const { t } = useLanguage();
  const li = 'leading-relaxed';

  return (
    <>
      <SectionCard title={t('ir_why_title')}>
        <div className="prose prose-invert max-w-none text-text-200 space-y-4">
          <p>{t('ir_why_intro')}</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-text-300">
            <li className={li}><strong>{t('ir_why_b1_t')}</strong> {t('ir_why_b1')}</li>
            <li className={li}><strong>{t('ir_why_b2_t')}</strong> {t('ir_why_b2')}</li>
            <li className={li}><strong>{t('ir_why_b3_t')}</strong> {t('ir_why_b3')}</li>
            <li className={li}><strong>{t('ir_why_b4_t')}</strong> {t('ir_why_b4')}</li>
          </ul>

          <h4 className="text-lg font-semibold text-text-100 mt-4">{t('ir_loop_title')}</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>{t('ir_loop_s1')}</li>
            <li>{t('ir_loop_s2')}</li>
            <li>{t('ir_loop_s3')}</li>
            <li>{t('ir_loop_s4')}</li>
            <li>{t('ir_loop_s5')}</li>
          </ol>
          <div className="bg-bg-300 p-4 rounded-lg text-sm border-l-4 border-primary-100 space-y-2">
            <p>{t('ir_loop_formula_caption')}</p>
            <p className="font-mono text-text-100 overflow-x-auto whitespace-nowrap">{t('ir_loop_formula')}</p>
            <p>{t('ir_loop_objective')}</p>
          </div>
          <p className="text-sm">
            <strong>{t('ir_semiconv_t')}</strong> {t('ir_semiconv')}
          </p>

          <h4 className="text-lg font-semibold text-text-100 mt-4">{t('ir_types_title')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
            <div className="rounded-lg bg-bg-200 p-4 text-sm space-y-2">
              <h5 className="font-semibold text-text-100">{t('ir_hybrid_title')}</h5>
              <p>{t('ir_hybrid_1')}</p>
              <p>{t('ir_hybrid_2')}</p>
            </div>
            <div className="rounded-lg bg-bg-200 p-4 text-sm space-y-2">
              <h5 className="font-semibold text-text-100">{t('ir_mbir_title')}</h5>
              <p>{t('ir_mbir_1')}</p>
              <p>{t('ir_mbir_2')}</p>
            </div>
          </div>
          <p className="text-sm">{t('ir_names_note')}</p>
          <div className="bg-bg-300 p-4 rounded-lg text-sm border-l-4 border-accent-100">
            <strong>{t('ir_nonlinear_t')}</strong> {t('ir_nonlinear')}
          </div>
        </div>

        <SimulatorContainer title={t('ir_demo_title')} description={t('ir_demo_desc')} enableLiquidEffect={false}>
          <IterativeReconSimulator />
        </SimulatorContainer>
      </SectionCard>

      <SectionCard title={t('dl_title')}>
        <div className="prose prose-invert max-w-none text-text-200 space-y-4">
          <p>{t('dl_intro')}</p>

          <h4 className="text-lg font-semibold text-text-100">{t('dl_train_title')}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>{t('dl_train_1')}</li>
            <li>{t('dl_train_2')}</li>
            <li>{t('dl_train_3')}</li>
            <li>{t('dl_train_4')}</li>
          </ul>

          <h4 className="text-lg font-semibold text-text-100">{t('dl_arch_title')}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>{t('dl_arch_img_t')}</strong> {t('dl_arch_img')}</li>
            <li><strong>{t('dl_arch_raw_t')}</strong> {t('dl_arch_raw')}</li>
            <li><strong>{t('dl_arch_unroll_t')}</strong> {t('dl_arch_unroll')}</li>
          </ul>

          <h4 className="text-lg font-semibold text-text-100">{t('dl_pitfalls_title')}</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>{t('dl_pit_1_t')}</strong> {t('dl_pit_1')}</li>
            <li><strong>{t('dl_pit_2_t')}</strong> {t('dl_pit_2')}</li>
            <li><strong>{t('dl_pit_3_t')}</strong> {t('dl_pit_3')}</li>
            <li><strong>{t('dl_pit_4_t')}</strong> {t('dl_pit_4')}</li>
          </ul>

          <div className="bg-bg-300 p-4 rounded-lg text-sm border-l-4 border-primary-100">
            <strong>{t('dl_validate_title')}</strong> {t('dl_validate')}
          </div>
        </div>
      </SectionCard>
    </>
  );
};

export default IterativeReconSection;

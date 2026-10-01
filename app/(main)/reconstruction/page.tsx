'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import BackprojectionSimulator from '@/components/simulators/BackprojectionSimulator';
import HelicalCTSimulator from '@/components/simulators/HelicalCTSimulator';
import CBCTSimulator from '@/components/simulators/CBCTSimulator';
import CBCTApplications from '@/components/simulators/CBCTApplications';
import IterativeReconSection from '@/components/simulators/IterativeReconSection';

import { useLanguage } from '@/context/LanguageContext';

export default function ReconstructionPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('fbp');

  return (
    <div className="min-h-screen pb-20">
      <PageHeader
        title={t('recon_title')}
        description={t('recon_desc')}
      />

      <main className="container mx-auto px-4 space-y-8 -mt-8 relative z-10">

        {/* Navigation Tabs */}
        <div className="flex justify-center space-x-4 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fbp')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'fbp' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            {t('recon_tab_fbp')}
          </button>
          <button
            onClick={() => setActiveTab('cbct')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'cbct' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            {t('recon_tab_cbct')}
          </button>
          <button
            onClick={() => setActiveTab('helical')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === 'helical' ? 'bg-primary-100 text-white' : 'bg-bg-200 text-text-200 hover:bg-bg-300'}`}
          >
            {t('recon_tab_helical')}
          </button>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {activeTab === 'fbp' && (
            <>
              <SectionCard title={t('recon_problem_title')}>
                <div className="prose prose-invert max-w-none text-text-200">
                  <p>
                    {t('recon_problem_desc_a')}
                    <strong>{t('recon_problem_term')}</strong>
                    {t('recon_problem_desc_b')}
                  </p>
                </div>
              </SectionCard>

              <SectionCard title={t('recon_fbp_title')}>
                <div className="space-y-6">
                  <div className="prose prose-invert max-w-none text-text-200">
                    <p>
                      {t('recon_fbp_intro_a')}
                      <strong>{t('recon_fbp_raw_term')}</strong>
                      {t('recon_fbp_raw_desc')}
                      <strong>{t('recon_fbp_fbp_term')}</strong>
                      {t('recon_fbp_fbp_desc')}
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-text-300">
                      <li><strong>{t('recon_fbp_matrix_term')}</strong> {t('recon_fbp_matrix')}</li>
                      <li><strong>{t('recon_fbp_fan_term')}</strong> {t('recon_fbp_fan')}</li>
                      <li><strong>{t('recon_fbp_det_term')}</strong> {t('recon_fbp_detectors')}</li>
                    </ul>
                  </div>

                  <SimulatorContainer title={t('recon_sim_title')} description={t('recon_sim_desc')} enableLiquidEffect={false}>
                    <BackprojectionSimulator />
                  </SimulatorContainer>
                </div>
              </SectionCard>

              <IterativeReconSection />
            </>
          )}

          {activeTab === 'cbct' && (
            <>
              <SectionCard title={t('cbct_phys_title')}>
                <div className="space-y-6">
                  <div className="prose prose-invert max-w-none text-text-200">
                    <p>
                      <strong>{t('recon_tab_cbct')}</strong> {t('cbct_phys_desc')} {t('cbct_phys_resolution')}
                    </p>
                    <h4 className="text-lg font-semibold text-text-100 mt-4">{t('cbct_fdk_title')}</h4>
                    <p>{t('cbct_fdk_desc')}</p>
                    <ul className="list-decimal list-inside space-y-2 mt-2">
                      <li><strong>{t('cbct_fdk_w_term')}</strong> {t('cbct_fdk_w')}</li>
                      <li><strong>{t('cbct_fdk_f_term')}</strong> {t('cbct_fdk_f')}</li>
                      <li><strong>{t('cbct_fdk_b_term')}</strong> {t('cbct_fdk_b')}</li>
                    </ul>
                    <div className="bg-bg-300 p-4 rounded-lg mt-4 text-sm border-l-4 border-primary-100">
                      <strong>{t('common_note')}</strong>{t('cbct_note')}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t('cbct_sim_title')}>
                <CBCTSimulator />
              </SectionCard>

              <CBCTApplications />
            </>
          )}

          {activeTab === 'helical' && (
            <SectionCard title={t('helical_title')}>
              <div className="prose prose-invert max-w-none text-text-200 mb-6">
                <p>
                  {t('helical_intro_a')}
                  <strong>{t('helical_intro_term')}</strong>
                  {t('helical_intro_b')}
                </p>
                <ul className="list-disc list-inside">
                  <li><strong>{t('hel_pitch')} &lt; 1:</strong> {t('helical_lt1')}</li>
                  <li><strong>{t('hel_pitch')} &gt; 1:</strong> {t('helical_gt1')}</li>
                  <li><strong>{t('hel_pitch')} = 1:</strong> {t('helical_eq1')}</li>
                </ul>
              </div>
              <SimulatorContainer title={t('helical_sim_title')} description={t('helical_sim_desc')} enableLiquidEffect={false}>
                <HelicalCTSimulator />
              </SimulatorContainer>
            </SectionCard>
          )}

        </motion.div>
      </main>
    </div>
  );
}
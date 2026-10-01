'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import TabGroup from '@/components/ui/TabGroup';
import CardiacGatingSimulator from '@/components/simulators/CardiacGatingSimulator';
import { useLanguage } from '@/context/LanguageContext';
import { useContent } from '@/data/content';

const CardiacPage: React.FC = () => {
  const { t } = useLanguage();
  const pageData = useContent('cardiac');
  const [activeSection, setActiveSection] = useState(pageData.sections[0]?.id || 'cardiac-gating');

  const tabs = pageData.sections.map(section => ({
    id: section.id,
    label: section.title
  }));

  const activeContent = pageData.sections.find(section => section.id === activeSection);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader
        title={pageData.title}
        description={pageData.description}
      />

      <TabGroup
        tabs={tabs}
        activeTab={activeSection}
        onChange={setActiveSection}
      />

      <div className="mt-8">
        {activeContent && (
          <motion.div
            key={activeContent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SectionCard
              title={activeContent.title}
              description={activeContent.description}
            >
              <div className="prose prose-sm max-w-none text-text-100">
                <p>{activeContent.content}</p>
              </div>

              {activeContent.keyPoints && (
                <KeyPoints points={activeContent.keyPoints} />
              )}

              {activeContent.id === 'cardiac-gating' && (
                <div className="mt-8">
                  <CardiacGatingSimulator />
                </div>
              )}

              {activeContent.id === 'temporal-resolution' && (
                <div className="mt-8">
                  <SimulatorContainer
                    title={t('card_tr_title')}
                    description={t('card_tr_desc')}
                  >
                    <TemporalResolutionCalculator />
                  </SimulatorContainer>
                </div>
              )}

              {activeContent.id === 'radiation-dose' && (
                <div className="mt-8">
                  <SimulatorContainer
                    title={t('card_dose_title')}
                    description={t('card_dose_desc')}
                  >
                    <CardiacDoseCalculator />
                  </SimulatorContainer>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Temporal Resolution Calculator Component
const TemporalResolutionCalculator: React.FC = () => {
  const { t } = useLanguage();
  const [rotationTime, setRotationTime] = useState(0.5);
  const [isMultisource, setIsMultisource] = useState(false);

  // For single source half-scan: T_res = T_rot / 2
  // For dual source quarter-scan: T_res = T_rot / 4
  const temporalResolution = isMultisource ? rotationTime / 4 : rotationTime / 2;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            {t('card_tr_rot')}
          </label>
          <input
            type="number"
            value={rotationTime}
            onChange={(e) => setRotationTime(parseFloat(e.target.value))}
            step={0.1}
            min={0.2}
            max={2.0}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-transparent bg-bg-200 text-text-100"
          />
        </div>

        <div>
          <label className="flex items-center space-x-3 mt-8">
            <input
              type="checkbox"
              checked={isMultisource}
              onChange={(e) => setIsMultisource(e.target.checked)}
              className="w-4 h-4 text-primary-100 rounded focus:ring-primary-100"
            />
            <span className="text-sm font-medium text-text-100">
              {t('card_tr_dual')}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-bg-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-sm text-text-200 mb-2">{t('card_tr_label')}</div>
          <div className="text-4xl font-bold text-primary-100">
            {(temporalResolution * 1000).toFixed(0)} ms
          </div>
          <div className="text-sm text-text-200 mt-2">
            {isMultisource ? t('card_tr_quarter') : t('card_tr_half')}
          </div>
        </div>
      </div>

      <div className="text-sm text-text-200">
        <p>
          <strong>{t('common_note')}</strong>{t('card_tr_note')}
        </p>
      </div>
    </div>
  );
};

// Cardiac Dose Calculator Component
const CardiacDoseCalculator: React.FC = () => {
  const { t } = useLanguage();
  const [gatingType, setGatingType] = useState<'prospective' | 'retrospective'>('prospective');
  const [heartRate, setHeartRate] = useState(70);

  const baseDose = gatingType === 'prospective' ? 3 : 12; // mSv
  const heartRateFactor = heartRate > 70 ? 1.2 : 1.0;
  const estimatedDose = baseDose * heartRateFactor;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            {t('card_dose_gating')}
          </label>
          <select
            value={gatingType}
            onChange={(e) => setGatingType(e.target.value as 'prospective' | 'retrospective')}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 bg-bg-200 text-text-100"
          >
            <option value="prospective">{t('card_dose_opt_pro')}</option>
            <option value="retrospective">{t('card_dose_opt_retro')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-100 mb-2">
            {t('card_dose_hr')}
          </label>
          <input
            type="number"
            value={heartRate}
            onChange={(e) => setHeartRate(parseInt(e.target.value))}
            min={40}
            max={120}
            className="w-full px-4 py-2 border border-border-100 rounded-lg focus:ring-2 focus:ring-primary-100 bg-bg-200 text-text-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">{t('card_dose_est')}</div>
          <div className="text-2xl font-bold text-primary-100 mt-1">
            {estimatedDose.toFixed(1)} mSv
          </div>
        </motion.div>

        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">{t('card_dose_red')}</div>
          <div className="text-2xl font-bold text-green-500 mt-1">
            {gatingType === 'prospective' ? '70–80%' : t('card_dose_baseline')}
          </div>
        </motion.div>

        <motion.div
          className="bg-bg-200 rounded-lg p-4 text-center border border-border-100"
          whileHover={{ scale: 1.02 }}
        >
          <div className="text-sm text-text-200">{t('card_dose_iq')}</div>
          <div className="text-2xl font-bold text-accent-100 mt-1">
            {heartRate <= 65 ? t('card_iq_excellent') : heartRate <= 80 ? t('card_iq_good') : t('card_iq_fair')}
          </div>
        </motion.div>
      </div>

      <div className="bg-yellow-50/10 border border-yellow-200/50 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          <strong>{t('card_rec_title')}</strong>
          {heartRate > 70 && t('card_rec_bb')}
          {gatingType === 'retrospective' && t('card_rec_mod')}
          {gatingType === 'prospective' && heartRate <= 65 && t('card_rec_best')}
        </p>
      </div>
    </div>
  );
};

export default CardiacPage;
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import TabGroup from '@/components/ui/TabGroup';
import BackprojectionSimulator from '@/components/simulators/BackprojectionSimulator';
import HelicalCTSimulator from '@/components/simulators/HelicalCTSimulator';
import { PageData } from '@/types';
import { validatePageData } from '@/utils/data-manager';

// Import data
import reconstructionData from '@/data/reconstruction.json';

const ReconstructionPage: React.FC = () => {
  // Validate and type the data
  const pageData = validatePageData(reconstructionData) as PageData;

  const [activeSection, setActiveSection] = useState(pageData.sections[0]?.id || 'backprojection');

  const tabs = pageData.sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: section.id === 'backprojection' ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ) : section.id === 'helical-ct' ? (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ) : null
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

      <div className="mt-8">
        <TabGroup
          tabs={tabs}
          activeTab={activeSection}
          onChange={setActiveSection}
        />
      </div>

      <div className="mt-8">
        {activeContent && (
          <motion.div
            key={activeContent.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <SectionCard
              title={activeContent.title}
              description={activeContent.description}
            >
              {activeContent.content && (
                <div className="prose prose-sm max-w-none text-text-100 mb-6">
                  <p className="whitespace-pre-line">{activeContent.content}</p>
                </div>
              )}

              {activeContent.keyPoints && (
                <KeyPoints points={activeContent.keyPoints} />
              )}

              {activeContent.simulator && (
                <div className="mt-8">
                  <SimulatorContainer
                    title={`${activeContent.title} Simulator`}
                    description="Interact with the parameters to see how they affect the results"
                    enableLiquidEffect={true}
                  >
                    {activeContent.simulator.type === 'backprojection' && (
                      <BackprojectionSimulator options={activeContent.simulator.options} />
                    )}
                    {activeContent.simulator.type === 'helical-ct' && (
                      <HelicalCTSimulator />
                    )}
                  </SimulatorContainer>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </div>

      {/* Additional learning resources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="bg-bg-100 rounded-lg border border-border-100 p-6">
          <h3 className="text-lg font-semibold text-text-100 mb-3">
            Quick Reference
          </h3>
          <ul className="space-y-2 text-sm text-text-200">
            <li className="flex items-start">
              <span className="text-primary-100 mr-2">•</span>
              <span><strong>Nyquist Theorem:</strong> Need at least π × (image width) projections for accurate reconstruction</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-100 mr-2">•</span>
              <span><strong>Pitch = 1:</strong> Contiguous helical scanning with no overlap or gaps</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary-100 mr-2">•</span>
              <span><strong>Ramp Filter:</strong> Essential for removing blurring in backprojection</span>
            </li>
          </ul>
        </div>

        <div className="bg-accent-100 bg-opacity-10 rounded-lg border border-accent-100 border-opacity-30 p-6">
          <h3 className="text-lg font-semibold text-accent-100 mb-3">
            Clinical Tip
          </h3>
          <p className="text-sm text-text-100">
            When selecting pitch values for helical CT, consider the clinical indication.
            Use lower pitch (0.5-0.8) for high-resolution studies like CT angiography,
            and higher pitch (1.2-1.5) for rapid surveys or trauma protocols where
            speed is critical.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReconstructionPage;
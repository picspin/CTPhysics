'use client';

import React from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import KeyPoints from '@/components/ui/KeyPoints';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import DualEnergyReconstructionSimulator from '@/components/simulators/DualEnergyReconstructionSimulator';
import XrayAttenuationSimulator from '@/components/simulators/XrayAttenuationSimulator';
import BeamHardeningSimulator from '@/components/simulators/BeamHardeningSimulator';
import TabGroup from '@/components/ui/TabGroup';

// 从JSON文件导入数据
import dualEnergyData from '@/data/dual-energy.json';

export default function DualEnergyPage() {
    return (
        <div className="space-y-8 animate-fadeIn">
            <PageHeader
                title={dualEnergyData.title}
                description={dualEnergyData.description}
            />

            {dualEnergyData.sections.map((section) => (
                <SectionCard
                    key={section.id}
                    title={section.title}
                    description={section.description}
                    className="hover-lift"
                >
                    <div className="space-y-4">
                        <p className="text-text-200">{section.content}</p>

                        {section.keyPoints && (
                            <KeyPoints points={section.keyPoints} />
                        )}
                    </div>
                </SectionCard>
            ))}

            <SimulatorContainer title="Technology Simulators">
                <TabGroup
                    tabs={[
                        { id: 'attenuation', label: '1. X-Ray Attenuation' },
                        { id: 'hardening', label: '2. Beam Hardening' },
                        { id: 'dual-energy', label: '3. Dual Energy CT' },
                    ]}
                >
                    {(activeTab) => (
                        <>
                            {activeTab === 'attenuation' && (
                                <div id="attenuation" className="p-4">
                                    <XrayAttenuationSimulator />
                                </div>
                            )}
                            {activeTab === 'hardening' && (
                                <div id="hardening" className="p-4">
                                    <BeamHardeningSimulator />
                                </div>
                            )}
                            {activeTab === 'dual-energy' && (
                                <div id="dual-energy" className="p-4">
                                    <DualEnergyReconstructionSimulator />
                                </div>
                            )}
                        </>
                    )}
                </TabGroup>
            </SimulatorContainer>
        </div>
    );
}

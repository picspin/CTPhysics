'use client';

import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import SimulatorContainer from '@/components/ui/SimulatorContainer';
import TabGroup from '@/components/ui/TabGroup';
import { Select } from '@/components/ui/Select';
import { useLanguage, type MessageKey } from '@/context/LanguageContext';

const MATERIAL_KEY = {
  soft: 'de_mat_soft',
  fat: 'de_mat_fat',
  iodine: 'de_mat_iodine',
  bone: 'de_mat_bone',
  air: 'de_mat_air',
  calcium_stone: 'de_mat_calcium_stone',
} as const satisfies Record<string, MessageKey>;
type MaterialId = keyof typeof MATERIAL_KEY;

const DualEnergyReconstructionSimulator = () => {
  const { t } = useLanguage();
  const [selectedCase, setSelectedCase] = useState('liver');
  const [reconstructionType, setReconstructionType] = useState('virtual_noncontrast');
  interface MaterialComposition {
    name: MaterialId;
    conventional: number;
    virtual_noncontrast: number;
    iodine_overlay: number;
    bone_subtraction: number;
    lung_perfusion: number;
  }

  const [materialComposition, setMaterialComposition] = useState<MaterialComposition[]>([]);

  const reconstructionTypes = [
    { id: 'virtual_noncontrast', label: t('de_rt_virtual_noncontrast') },
    { id: 'iodine_overlay', label: t('de_rt_iodine_overlay') },
    { id: 'bone_subtraction', label: t('de_rt_bone_subtraction') },
    { id: 'lung_perfusion', label: t('de_rt_lung_perfusion') }
  ];

  const cases = [
    { id: 'liver', name: t('de_case_liver') },
    { id: 'lung', name: t('de_case_lung') },
    { id: 'kidney', name: t('de_case_kidney') }
  ];

  // Illustrative material-decomposition data (keyed by material id)
  useEffect(() => {
    const generateMaterialData = () => {
      // Material composition per case (illustrative data)
      const compositions: Record<string, MaterialComposition[]> = {
        'liver': [
          { name: 'soft', conventional: 65, virtual_noncontrast: 65, iodine_overlay: 65, bone_subtraction: 70, lung_perfusion: 65 },
          { name: 'fat', conventional: 15, virtual_noncontrast: 15, iodine_overlay: 15, bone_subtraction: 15, lung_perfusion: 15 },
          { name: 'iodine', conventional: 15, virtual_noncontrast: 0, iodine_overlay: 15, bone_subtraction: 15, lung_perfusion: 15 },
          { name: 'bone', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 0, lung_perfusion: 5 },
          { name: 'air', conventional: 0, virtual_noncontrast: 0, iodine_overlay: 0, bone_subtraction: 0, lung_perfusion: 0 }
        ],
        'lung': [
          { name: 'soft', conventional: 30, virtual_noncontrast: 30, iodine_overlay: 30, bone_subtraction: 35, lung_perfusion: 30 },
          { name: 'fat', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 5, lung_perfusion: 5 },
          { name: 'iodine', conventional: 10, virtual_noncontrast: 0, iodine_overlay: 10, bone_subtraction: 10, lung_perfusion: 10 },
          { name: 'bone', conventional: 15, virtual_noncontrast: 15, iodine_overlay: 15, bone_subtraction: 0, lung_perfusion: 15 },
          { name: 'air', conventional: 40, virtual_noncontrast: 40, iodine_overlay: 40, bone_subtraction: 50, lung_perfusion: 40 }
        ],
        'kidney': [
          { name: 'soft', conventional: 60, virtual_noncontrast: 60, iodine_overlay: 60, bone_subtraction: 65, lung_perfusion: 60 },
          { name: 'fat', conventional: 20, virtual_noncontrast: 20, iodine_overlay: 20, bone_subtraction: 20, lung_perfusion: 20 },
          { name: 'iodine', conventional: 10, virtual_noncontrast: 0, iodine_overlay: 10, bone_subtraction: 10, lung_perfusion: 10 },
          { name: 'bone', conventional: 5, virtual_noncontrast: 5, iodine_overlay: 5, bone_subtraction: 0, lung_perfusion: 5 },
          { name: 'calcium_stone', conventional: 5, virtual_noncontrast: 15, iodine_overlay: 5, bone_subtraction: 5, lung_perfusion: 5 }
        ]
      };

      setMaterialComposition(compositions[selectedCase]);
    };

    generateMaterialData();
  }, [selectedCase]);

  return (
    <SimulatorContainer title={t('de_title')}>
      <div className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label={t('de_select_case')}
            options={cases.map(c => ({ value: c.id, label: c.name }))}
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
          />
        </div>

        <TabGroup
          tabs={reconstructionTypes}
          activeTab={reconstructionType}
          onChange={setReconstructionType}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border border-border-100 bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">{t('de_conventional_image')}</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {/* Simulated CT image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedCase === 'liver' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-gray-500"></div>
                      </div>
                    </div>
                  )}

                  {selectedCase === 'lung' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-900">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/6 w-1/6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-600"></div>
                      </div>
                    </div>
                  )}

                  {selectedCase === 'kidney' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/4 rounded-full bg-gray-600"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/4 rounded-full bg-gray-600"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/8 w-1/8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-2 left-2 rounded bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
                  {t('de_conventional_label')}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border-100 bg-bg-100 p-4">
            <div className="mb-2 text-sm font-medium text-text-100">{t('de_recon_image')}</div>
            <div className="aspect-square w-full overflow-hidden rounded-md bg-black">
              <div className="relative h-full w-full">
                {/* Simulated dual-energy reconstruction image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {selectedCase === 'liver' && reconstructionType === 'virtual_noncontrast' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-600">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-gray-500"></div>
                      </div>
                    </div>
                  )}

                  {selectedCase === 'liver' && reconstructionType === 'iodine_overlay' && (
                    <div className="h-3/4 w-3/4 rounded-full bg-gray-700">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/4 w-1/4 rounded-full bg-blue-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/6 w-1/6 rounded-full bg-blue-500"></div>
                      </div>
                    </div>
                  )}

                  {selectedCase === 'lung' && reconstructionType === 'lung_perfusion' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-900">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/3 rounded-full bg-gray-800"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/6 w-1/6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600"></div>
                      </div>
                    </div>
                  )}

                  {selectedCase === 'kidney' && reconstructionType === 'virtual_noncontrast' && (
                    <div className="h-3/4 w-3/4 rounded-md bg-gray-600">
                      <div className="relative h-full w-full">
                        <div className="absolute left-1/4 top-1/4 h-1/3 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute bottom-1/4 right-1/4 h-1/3 w-1/4 rounded-full bg-gray-500"></div>
                        <div className="absolute left-1/2 top-1/2 h-1/8 w-1/8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"></div>
                      </div>
                    </div>
                  )}

                  {/* Fallback: reconstruction type not applicable to this case */}
                  {((selectedCase === 'liver' && (reconstructionType === 'bone_subtraction' || reconstructionType === 'lung_perfusion')) ||
                    (selectedCase === 'lung' && (reconstructionType === 'virtual_noncontrast' || reconstructionType === 'iodine_overlay' || reconstructionType === 'bone_subtraction')) ||
                    (selectedCase === 'kidney' && (reconstructionType === 'iodine_overlay' || reconstructionType === 'bone_subtraction' || reconstructionType === 'lung_perfusion'))) && (
                      <div className="flex h-full w-full items-center justify-center text-white">
                        <p>{t('de_not_applicable')}</p>
                      </div>
                    )}
                </div>

                <div className="absolute bottom-2 left-2 rounded bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
                  {reconstructionTypes.find(type => type.id === reconstructionType)?.label || ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border-100 bg-bg-100 p-4">
          <div className="mb-2 text-sm font-medium text-text-100">{t('de_material_title')}</div>
          <div className="h-64 w-full md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={materialComposition}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} label={{ value: t('de_axis_percent'), position: 'insideBottom', offset: -5 }} />
                <YAxis dataKey="name" type="category" width={90} tickFormatter={(id: MaterialId) => t(MATERIAL_KEY[id])} />
                <Tooltip formatter={(value) => [`${value}%`, t('de_tooltip_ratio')]} />
                <Legend />
                <Bar
                  dataKey="conventional"
                  name={t('de_series_conventional')}
                  fill="#cccccc"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey={reconstructionType}
                  name={reconstructionTypes.find(type => type.id === reconstructionType)?.label || ''}
                  fill="#FF8C00"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-md bg-bg-200 p-4 text-sm text-text-200">
        <h3 className="mb-2 font-medium text-text-100">{t('de_desc_title')}</h3>
        <p>{t('de_desc_intro')}</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><span className="font-medium">{t('de_rt_virtual_noncontrast')}</span>{t('common_colon')}{t('de_desc_vnc')}</li>
          <li><span className="font-medium">{t('de_rt_iodine_overlay')}</span>{t('common_colon')}{t('de_desc_io')}</li>
          <li><span className="font-medium">{t('de_rt_bone_subtraction')}</span>{t('common_colon')}{t('de_desc_bs')}</li>
          <li><span className="font-medium">{t('de_rt_lung_perfusion')}</span>{t('common_colon')}{t('de_desc_lp')}</li>
        </ul>
        <p className="mt-2">{t('de_desc_outro')}</p>
      </div>
    </SimulatorContainer>
  );
};

export default DualEnergyReconstructionSimulator;

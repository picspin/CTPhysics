'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'zh' | 'en';

type Translations = Record<string, string>;

const dict: Record<Language, Translations> = {
  "zh": {
    "title": "CT物理原理交互式学习平台",
    "overview": "概览 (Overview)",
    "subtitle": "用于理解CT物理原理的高级交互式模拟和可视化教学工具",
    "reconstruction": "CT重建与螺旋CT",
    "pcct": "光子计数CT (PCCT)",
    "dose": "剂量与安全",
    "cardiac": "心脏CT",
    "dual_energy": "双能CT",
    "practice": "复习与练习",
    "github": "GitHub 仓库",
    "settings": "设置",
    "theme": "主题/风格",
    "language": "语言",
    "close": "关闭",
    "theme_glass": "液态玻璃",
    "theme_minimal": "极简扁平",
    "recon_title": "图像重建与螺旋CT",
    "recon_desc": "了解将探测器原始数据转换为诊断图像的数学原理与物理过程。",
    "recon_tab_fbp": "BP & FBP 模拟器",
    "recon_tab_cbct": "锥束CT (CBCT)",
    "recon_tab_helical": "螺旋CT与螺距",
    "recon_problem_title": "CT重建原理 (The Reconstruction Problem)",
    "recon_problem_desc": "CT扫描仪从多个不同角度测量穿过人体的X射线衰减量。这些原始数据被称为正弦图 (Sinogram)（或Radon变换），必须经过处理才能生成用于诊断的横断面图像。",
    "recon_fbp_title": "反投影与滤波反投影 (BP & FBP)",
    "recon_fbp_desc": "此模拟器展示了现代重建算法的两个核心步骤。直接反投影简单地将数据沿射线路径涂抹回去，导致图像模糊。滤波反投影首先应用数学滤波器（如Ramp核）锐化数据，从而恢复正确的图像边缘和密度。",
    "recon_fbp_matrix": "矩阵大小 (Matrix Size): 决定了重建图像的分辨率（如 512x512 为高保真模式）。",
    "recon_fbp_fan": "扇束角度 (Fan Angle): 模拟真实的X射线源发散几何。",
    "recon_fbp_detectors": "探测器 (Detectors): 决定了采样精度。",
    "recon_sim_title": "重建模拟器 (Reconstruction Simulator)",
    "recon_sim_desc": "比较 原始反投影 与 滤波反投影 的效果",
    "cbct_phys_title": "锥束CT (Cone Beam CT) 物理原理",
    "cbct_phys_desc": "锥束CT使用锥形X射线束和平面探测器，在一次旋转中即可获取整个体积的数据。",
    "cbct_fdk_title": "FDK 算法 (Feldkamp-Davis-Kress)",
    "cbct_fdk_desc": "FDK 是最为经典的 CBCT 重建算法，它是 FBP 算法在 3D 锥束几何下的近似推广。",
    "cbct_fdk_w": "加权 (Weighting): 对投影数据进行由几何带来的位置加权。",
    "cbct_fdk_f": "滤波 (Filtering): 对每一行探测器数据应用一维 Ramp 滤波器。",
    "cbct_fdk_b": "反投影 (Backprojection): 沿 3D 锥体几何光路将数据反投影到体素网格中。",
    "cbct_note": "注：圆锥角增大时，由于拉东数据不完备性，会导致偏轴体素产生严重的锥束伪影。",
    "cbct_sim_title": "锥束CT物理模拟",
    "pcct_title": "光子计数CT (PCCT) 物理孪生模拟",
    "pcct_desc": "探索光子计数探测器 (PCD) 的直接转换转换物理学、多能能级分桶机制以及能谱物质分离与虚拟单能级成像 (VMI) 的优势。",
    "pcct_tab_acq": "物理采集",
    "pcct_tab_det": "探测器层",
    "pcct_tab_dec": "物质分解",
    "pcct_img_title": "重建图像对比：冠状动脉 CTA 与斑块、金属支架",
    "pcct_eid_label": "传统积分 CT (EID)",
    "pcct_pcd_label": "光子计数 CT (PCCT)",
    "pcct_noise_eid": "电子噪声：~18 HU (EID限制)",
    "pcct_noise_pcd": "电子噪声：0 HU (零噪声)",
    "pcct_blooming": "钙化膨胀 (Blooming)",
    "pcct_stent_lumen": "支架评估通畅率",
    "pcct_bin_label": "能级通道",
    "pcct_bin_hint": "选择不同 Bin 可观察高低能量下物质投影的衰减反差变化。",
    "pcct_binning_title": "探测器能级分桶与非理想效应",
    "pcct_binning_desc": "配合不同能级阈值可实现对多对比度介质或特征吸收K-edge突变材料的靶向提取。",
    "pcct_t1": "阈值 1 (Low Bin)",
    "pcct_t1_hint": "用于剔除低能量的暗电荷与电子基线噪声。",
    "pcct_t2": "阈值 2 (Mid Bin)",
    "pcct_t2_hint": "配合 K-edge 边界实现对特定重元素的精确提取。",
    "pcct_t3": "阈值 3 (High Bin)",
    "pcct_t3_hint": "提取高能量康普顿衰减信息。",
    "pcct_pileup": "脉冲叠加比",
    "pcct_pileup_hint": "高通量引起计数丢失",
    "pcct_charge": "电荷共享比",
    "pcct_charge_hint": "电荷云被邻近像素平分",
    "pcct_escape": "K-escape 比",
    "pcct_escape_hint:": "CdTe 荧光逃逸引起谱偏移",
    "pcct_resolution": "能量分辨率退化",
    "pcct_resolution_hint": "物理谱宽的拓宽畸变",
    "pcct_mechanism_title": "物理层直接转换 vs 间接转换机制对比",
    "pcct_mechanism_eid": "间接转换 (EID / 闪烁体)",
    "pcct_mechanism_pcd": "直接转换 (PCCT / 半导体)",
    "pcct_scintillator": "闪烁体 (可见光散)",
    "pcct_pixel_eid": "像素元 (存在几何死区)",
    "pcct_substrate": "CdTe / CZT 介质",
    "pcct_pixel_pcd": "微像素 (几何剂量效率极高)",
    "pcct_spec_title": "X射线入射能谱畸变模拟 (理想 vs 非理想探测响应)",
    "pcct_dec_title": "能谱物质分解 (Material Decomposition)",
    "pcct_dec_composite": "复合色彩视图：红色代表钙化斑块 (骨骼成分)，绿色代表碘造影剂 (血管腔)，蓝色代表背景软组织。",
    "pcct_dec_iodine": "纯碘密度图 (Iodine Map)：彻底分离钙化，仅显示冠脉血池。",
    "pcct_dec_calcium": "纯钙密度图 (Calcium Map)：清晰展现冠脉壁上的硬化斑块形态。",
    "pcct_dec_residual": "残差与伪影分布图：显示基线物质分解模型无法解释的系统非理想噪声分量。",
    "pcct_vmi_title": "VMI 虚拟单色能成像 (Virtual Monoenergetic Images)",
    "pcct_vmi_subtitle": "观察低 keV 血管增强与高 keV 抑制金属/硬化伪影的工程权衡",
    "pcct_effect_title": "能谱物理效应表现：",
    "pcct_eff_40": "• 低能 40 keV：造影剂的衰减极高，血管腔获得显著的对比度增强。但高 Z 物质会引起极其严重的硬化条纹伪影与钙化 Blooming 边缘膨胀。",
    "pcct_eff_60": "• 60 keV：在管腔对比度与伪影之间取得折中，这是临床能谱血管造影的常用高对比能级。",
    "pcct_eff_70": "• 70 keV：标准模拟参考能级，接近常规 120 kVp 多色混合射线重建图像的软组织反差表现。",
    "pcct_eff_100": "• 高能 100 keV：X射线硬化伪影被彻底消除。支架管腔通畅度极佳，Blooming 彻底消失，但造影剂对比度被大幅削弱。",
    "pcct_vmi_factors": "当前 VMI 物理因子：",
    "pcct_vmi_lumen": "血管腔强度倍率",
    "pcct_vmi_streak": "硬化伪影严重度",
    "pcct_vmi_blooming": "硬斑块 Blooming 膨胀率",
    "pcct_hist_title": "各组织与支架 HU 衰减值对比图",
    "pcct_kedge_title": "重元素 K-edge 教学与吸收光谱突跃对比",
    "pcct_kedge_desc": "展示特定元素在 K-edge 临界能量点发生的光电吸收骤增，能谱 CT 正是基于此原理进行特异性造影成像",
    "pcct_kedge_iodine": "碘 (Iodine - K: 33 keV)",
    "pcct_kedge_gadolinium": "钆 (Gadolinium - K: 50 keV)",
    "pcct_kedge_bismuth": "铋 (Bismuth - K: 90 keV)",
    "pcct_kedge_calcium": "钙 (Calcium - 骨骼)",
    "pcct_kedge_water": "水",
    "pcct_contrast_agent_label": "造影剂造影元素",
    "pcct_noise_option": "演示电子噪声 (低能阈值)"
  },
  "en": {
    "title": "CT Physics Interactive Learning Platform",
    "overview": "Overview",
    "subtitle": "Advanced interactive simulation and visualization tools for understanding CT physics.",
    "reconstruction": "CT Reconstruction & Helical CT",
    "pcct": "Photon-Counting CT (PCCT)",
    "dose": "Dose & Safety",
    "cardiac": "Cardiac CT",
    "dual_energy": "Dual Energy CT",
    "practice": "Practice & Quiz",
    "github": "GitHub Repo",
    "settings": "Settings",
    "theme": "UI Theme / Style",
    "language": "Language",
    "close": "Close",
    "theme_glass": "Liquid Glass",
    "theme_minimal": "Minimal Stark",
    "recon_title": "Image Reconstruction & Helical CT",
    "recon_desc": "Understand the mathematical principles and physics converting raw projection data into diagnostic images.",
    "recon_tab_fbp": "BP & FBP Simulator",
    "recon_tab_cbct": "Cone Beam CT (CBCT)",
    "recon_tab_helical": "Helical CT & Pitch",
    "recon_problem_title": "CT Reconstruction Principles",
    "recon_problem_desc": "CT scanners measure attenuation of X-rays passing through the patient. Raw data (Sinogram/Radon Transform) must be reconstructed.",
    "recon_fbp_title": "BP & FBP Reconstruction",
    "recon_fbp_desc": "Raw Backprojection smears data, causing 1/r blur. FBP applies a Ramp kernel filter to restore edges.",
    "recon_fbp_matrix": "Matrix Size: Grid resolution (e.g., 512x512).",
    "recon_fbp_fan": "Fan Angle: Divergent ray beam divergence.",
    "recon_fbp_detectors": "Detectors: Sampling density.",
    "recon_sim_title": "Reconstruction Simulator",
    "recon_sim_desc": "Compare BP vs. FBP",
    "cbct_phys_title": "Cone Beam CT (CBCT) Physics",
    "cbct_phys_desc": "CBCT uses a cone-shaped X-ray beam and a flat panel detector to scan volume in a single rotation.",
    "cbct_fdk_title": "FDK Reconstruction Algorithm",
    "cbct_fdk_desc": "FDK is FBP generalized for 3D cone geometry.",
    "cbct_fdk_w": "Weighting: diverging cosine weighting.",
    "cbct_fdk_f": "Filtering: horizontal 1D filtering.",
    "cbct_fdk_b": "Backprojection: volumetric backprojection.",
    "cbct_note:": "Note: Cone beam diverges off axis, introducing Feldman artifacts at large angles.",
    "cbct_sim_title": "Cone Beam CT Simulation",
    "pcct_title": "Photon-Counting CT (PCCT) Simulator",
    "pcct_desc": "Explore PCD direct conversion, energy binning, material decomposition, and Virtual Monoenergetic Imaging (VMI).",
    "pcct_tab_acq": "Acquisition",
    "pcct_tab_det": "Detector Layer",
    "pcct_tab_dec": "Decomposition",
    "pcct_img_title": "Reconstruction: Coronary CTA, Plaque, & Stent",
    "pcct_eid_label": "Energy Integrating CT (EID)",
    "pcct_pcd_label": "Photon-Counting CT (PCCT)",
    "pcct_noise_eid": "Electronic Noise: ~18 HU (EID limit)",
    "pcct_noise_pcd": "Electronic Noise: 0 HU (Zero noise)",
    "pcct_blooming": "Blooming Effect",
    "pcct_stent_lumen": "Stent Lumen Patency",
    "pcct_bin_label": "Energy Bin",
    "pcct_bin_hint": "Select bin to view projection contrast variations.",
    "pcct_binning_title": "Energy Binning & Non-ideal Effects",
    "pcct_binning_desc": "Adjusting energy thresholds extracts specific Z contrast elements.",
    "pcct_t1": "Threshold 1 (Low Bin)",
    "pcct_t1_hint": "Rejects baseline electronic noise.",
    "pcct_t2": "Threshold 2 (Mid Bin)",
    "pcct_t2_hint:": "Aids targeted K-edge separation.",
    "pcct_t3": "Threshold 3 (High Bin)",
    "pcct_t3_hint": "Collects high energy Compton data.",
    "pcct_pileup": "Pulse Pile-up Ratio",
    "pcct_pileup_hint": "Count losses due to high flux rate",
    "pcct_charge": "Charge Sharing Ratio",
    "pcct_charge_hint": "Charge shared with neighbor pixels",
    "pcct_escape": "K-escape Ratio",
    "pcct_escape_hint": "Spectrum shift due to CdTe fluorescence escape",
    "pcct_resolution": "Energy Resolution Degradation",
    "pcct_resolution_hint": "Broadening of the spectrum",
    "pcct_mechanism_title": "Direct (PCD) vs. Indirect (EID) Conversion",
    "pcct_mechanism_eid": "Indirect EID (Scintillator)",
    "pcct_mechanism_pcd": "Direct PCCT (Semiconductor)",
    "pcct_scintillator": "Scintillator (Visible light scatter)",
    "pcct_pixel_eid": "Pixel Cell (Geometric dead space)",
    "pcct_substrate": "CdTe / CZT Semiconductor Substrate",
    "pcct_pixel_pcd": "Micro-pixels (High dose efficiency)",
    "pcct_spec_title": "X-ray Spectrum Distortion Simulation",
    "pcct_dec_title": "Material Decomposition",
    "pcct_dec_composite:": "Composite: Red=Plaque, Green=Iodine, Blue=Soft tissue.",
    "pcct_dec_iodine": "Iodine Map: Isolates calcium plaque to assess lumen.",
    "pcct_dec_calcium": "Calcium Map: Calcium scoring.",
    "pcct_dec_residual": "Residual noise map.",
    "pcct_vmi_title": "Virtual Monoenergetic Images (VMI)",
    "pcct_vmi_subtitle": "Contrast boost vs Streak suppression trade-offs",
    "pcct_effect_title": "VMI Observations:",
    "pcct_eff_40": "• 40 keV: High contrast, but severe streaking and blooming artifacts.",
    "pcct_eff_60": "• 60 keV: Optimal angio contrast compromise.",
    "pcct_eff_70": "• 70 keV: Standard polychromatic reference.",
    "pcct_eff_100": "• 100 keV: Zero streaking and blooming, contrast is lower.",
    "pcct_vmi_factors": "Active VMI Physics Factors:",
    "pcct_vmi_lumen": "Lumen Contrast Multiplier",
    "pcct_vmi_streak": "Streak Artifact Severity",
    "pcct_vmi_blooming": "Blooming Ratio",
    "pcct_hist_title": "HU by Material",
    "pcct_kedge_title": "K-edge Attenuation Spectra",
    "pcct_kedge_desc": "Absorption increases at binding energy.",
    "pcct_kedge_iodine": "Iodine (K: 33 keV)",
    "pcct_kedge_gadolinium": "Gadolinium (K: 50 keV)",
    "pcct_kedge_bismuth": "Bismuth (K: 90 keV)",
    "pcct_kedge_calcium": "Calcium (Bone)",
    "pcct_kedge_water": "Water",
    "pcct_contrast_agent_label": "Contrast Agent",
    "pcct_noise_option": "Electronic Noise"
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

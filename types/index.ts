// Type definitions for CT Physics Web App

// Common types
export interface KeyPoint {
  id: string;
  text: string;
}

export interface Section {
  id: string;
  title: string;
  description: string;
  content?: string;
  keyPoints?: string[];
  simulator?: SimulatorConfig;
}

export interface PageData {
  title: string;
  description: string;
  sections: Section[];
}

// Simulator configurations
export interface SimulatorConfig {
  type: SimulatorType;
  options?: any;
}

export type SimulatorType = 
  | 'backprojection'
  | 'helical-ct'
  | 'cardiac-gating'
  | 'dual-energy'
  | 'radiation-dose'
  | 'xray-attenuation';

// Backprojection Simulator types
export interface BackprojectionOptions {
  images: ImageOption[];
  fanBeamAngles: FanBeamAngle[];
}

export interface ImageOption {
  id: string;
  name: string;
  src?: string;
}

export interface FanBeamAngle {
  value: number;
  name: string;
}

// Helical CT Simulator types
export interface HelicalCTOptions {
  images: ImageOption[];
  pitchValues: PitchValue[];
}

export interface PitchValue {
  value: number;
  name: string;
  description: string;
}

// Cardiac Gating Simulator types
export interface CardiacGatingOptions {
  gatingTypes: GatingType[];
  heartRateRange: {
    min: number;
    max: number;
    step: number;
  };
}

export interface GatingType {
  id: string;
  name: string;
  description?: string;
}

// Dual Energy Simulator types
export interface DualEnergyOptions {
  tissues: Tissue[];
  iodineConcentrations: number[];
  energyLevels: number[];
}

export interface Tissue {
  id: string;
  name: string;
  density: number;
  zeff?: number; // Effective atomic number
}

// Radiation Dose types
export interface RadiationDoseOptions {
  gatingTypes: GatingType[];
  patientSizes: PatientSize[];
  scanProtocols: ScanProtocol[];
}

export interface PatientSize {
  id: string;
  name: string;
  factor: number;
}

export interface ScanProtocol {
  id: string;
  name: string;
  baseDose: number;
}

// Animation and interaction types
export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export interface InteractionPoint {
  x: number;
  y: number;
  timestamp: number;
  data?: any;
}

// Chart data types
export interface ChartDataPoint {
  [key: string]: number | string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'scatter' | 'area';
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  series: SeriesConfig[];
}

export interface AxisConfig {
  label: string;
  min?: number;
  max?: number;
  unit?: string;
}

export interface SeriesConfig {
  dataKey: string;
  name: string;
  color?: string;
  strokeWidth?: number;
}

// Quiz types
export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizResult {
  questionId: number;
  selectedAnswer: number;
  isCorrect: boolean;
  timeSpent: number;
}

// Calculation utilities types
export interface CTParameters {
  kVp: number;
  mAs: number;
  pitch: number;
  collimation: number;
  rotationTime: number;
  ctdi?: number;
}

export interface DoseCalculation {
  ctdi: number;
  dlp: number;
  effectiveDose: number;
}

// UI Component props types
export interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  children: React.ReactNode;
  className?: string;
}

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  unit?: string;
  className?: string;
}

export interface SelectProps {
  label: string;
  options: Array<{ id: string; name: string; value?: any }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Data visualization types
export interface VisualizationData {
  type: 'image' | 'chart' | '3d' | 'animation';
  data: any;
  config?: any;
}

export interface ImageVisualization {
  src: string;
  alt: string;
  annotations?: Annotation[];
}

export interface Annotation {
  x: number;
  y: number;
  label: string;
  type: 'point' | 'area' | 'line';
}
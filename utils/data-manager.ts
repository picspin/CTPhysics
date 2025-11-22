// Data management utilities for standardized data structures
import { PageData, Section, SimulatorConfig, Question } from '@/types';

// Data validation utilities
export const validatePageData = (data: any): PageData => {
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Invalid page data: missing or invalid title');
  }

  if (!data.description || typeof data.description !== 'string') {
    throw new Error('Invalid page data: missing or invalid description');
  }

  if (!Array.isArray(data.sections)) {
    throw new Error('Invalid page data: sections must be an array');
  }

  data.sections.forEach((section: any, index: number) => {
    validateSection(section, index);
  });

  return data as PageData;
};

export const validateSection = (section: any, index: number): Section => {
  if (!section.id || typeof section.id !== 'string') {
    throw new Error(`Invalid section at index ${index}: missing or invalid id`);
  }

  if (!section.title || typeof section.title !== 'string') {
    throw new Error(`Invalid section ${section.id}: missing or invalid title`);
  }

  if (!section.description || typeof section.description !== 'string') {
    throw new Error(`Invalid section ${section.id}: missing or invalid description`);
  }

  if (section.keyPoints && !Array.isArray(section.keyPoints)) {
    throw new Error(`Invalid section ${section.id}: keyPoints must be an array`);
  }

  if (section.simulator) {
    validateSimulatorConfig(section.simulator);
  }

  return section as Section;
};

export const validateSimulatorConfig = (config: any): SimulatorConfig => {
  const validTypes = ['backprojection', 'helical-ct', 'cardiac-gating', 'dual-energy', 'radiation-dose', 'xray-attenuation'];

  if (!config.type || !validTypes.includes(config.type)) {
    throw new Error(`Invalid simulator config: type must be one of ${validTypes.join(', ')}`);
  }

  return config as SimulatorConfig;
};

// Data transformation utilities
export const transformLegacyData = (legacyData: any): PageData => {
  // Transform old data format to new standardized format
  const transformed: PageData = {
    title: legacyData.title || 'Untitled Page',
    description: legacyData.description || '',
    sections: []
  };

  if (legacyData.sections) {
    transformed.sections = legacyData.sections.map((section: any) => ({
      id: section.id || generateId(),
      title: section.title || 'Untitled Section',
      description: section.description || '',
      content: section.content,
      keyPoints: section.keyPoints || [],
      simulator: section.simulator
    }));
  }

  return transformed;
};

// Data merging utilities
export const mergePageData = (base: PageData, updates: Partial<PageData>): PageData => {
  return {
    ...base,
    ...updates,
    sections: updates.sections ? mergeSections(base.sections, updates.sections) : base.sections
  };
};

export const mergeSections = (baseSections: Section[], updateSections: Section[]): Section[] => {
  const sectionMap = new Map<string, Section>();

  // Add base sections
  baseSections.forEach(section => {
    sectionMap.set(section.id, section);
  });

  // Merge or add update sections
  updateSections.forEach(section => {
    const existing = sectionMap.get(section.id);
    if (existing) {
      sectionMap.set(section.id, { ...existing, ...section });
    } else {
      sectionMap.set(section.id, section);
    }
  });

  return Array.from(sectionMap.values());
};

// Data storage utilities
export class DataStore {
  private cache: Map<string, any> = new Map();
  private localStorage: Storage | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.localStorage = window.localStorage;
      this.loadFromLocalStorage();
    }
  }

  get<T>(key: string): T | null {
    return this.cache.get(key) || null;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.saveToLocalStorage(key, value);
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.removeFromLocalStorage(key);
  }

  clear(): void {
    this.cache.clear();
    if (this.localStorage) {
      const keys = Object.keys(this.localStorage).filter(key => key.startsWith('ctphysics_'));
      keys.forEach(key => this.localStorage!.removeItem(key));
    }
  }

  private loadFromLocalStorage(): void {
    if (!this.localStorage) return;

    const keys = Object.keys(this.localStorage).filter(key => key.startsWith('ctphysics_'));
    keys.forEach(key => {
      try {
        const value = JSON.parse(this.localStorage!.getItem(key) || '');
        const actualKey = key.replace('ctphysics_', '');
        this.cache.set(actualKey, value);
      } catch (error) {
        console.error(`Failed to load ${key} from localStorage:`, error);
      }
    });
  }

  private saveToLocalStorage<T>(key: string, value: T): void {
    if (!this.localStorage) return;

    try {
      this.localStorage.setItem(`ctphysics_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
    }
  }

  private removeFromLocalStorage(key: string): void {
    if (!this.localStorage) return;
    this.localStorage.removeItem(`ctphysics_${key}`);
  }
}

// Quiz data management
export const shuffleQuestions = (questions: Question[]): Question[] => {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const filterQuestionsByCategory = (
  questions: Question[],
  category: string
): Question[] => {
  return questions.filter(q => q.category === category);
};

export const filterQuestionsByDifficulty = (
  questions: Question[],
  difficulty: 'easy' | 'medium' | 'hard'
): Question[] => {
  return questions.filter(q => q.difficulty === difficulty);
};

// Simulator data management
export const loadSimulatorPresets = (simulatorType: string): any => {
  const presets = {
    'backprojection': {
      defaultProjectionCount: 180,
      minProjectionCount: 1,
      maxProjectionCount: 360,
      defaultFanBeamAngle: 60,
      filterTypes: ['none', 'ramp', 'shepp-logan', 'hamming']
    },
    'helical-ct': {
      defaultPitch: 1.0,
      pitchRange: { min: 0.1, max: 2.0, step: 0.1 },
      defaultRotationTime: 0.5,
      rotationTimes: [0.33, 0.5, 1.0]
    },
    'cardiac-gating': {
      defaultHeartRate: 70,
      heartRateRange: { min: 40, max: 120, step: 5 },
      gatingWindows: {
        prospective: { start: 70, end: 80 },
        retrospective: { start: 0, end: 100 }
      }
    },
    'dual-energy': {
      energyLevels: [80, 100, 120, 140],
      defaultLowEnergy: 80,
      defaultHighEnergy: 140,
      materials: ['water', 'calcium', 'iodine', 'fat']
    },
    'radiation-dose': {
      defaultCTDI: 10,
      ctdiRange: { min: 1, max: 50, step: 0.5 },
      kFactors: {
        head: 0.0021,
        chest: 0.014,
        abdomen: 0.015,
        pelvis: 0.015
      }
    },
    'xray-attenuation': {
      energyRange: { min: 20, max: 140, step: 5 },
      defaultEnergy: 70,
      tissues: [
        { id: 'water', zeff: 7.42, density: 1.0 },
        { id: 'bone', zeff: 13.8, density: 1.92 },
        { id: 'fat', zeff: 6.3, density: 0.95 },
        { id: 'muscle', zeff: 7.6, density: 1.05 },
        { id: 'lung', zeff: 7.64, density: 0.26 }
      ]
    }
  };

  return (presets as any)[simulatorType] || {};
};

// Utility functions
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Export singleton instance
export const dataStore = new DataStore();
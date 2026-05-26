import type { ProductionEntry } from './types';

export const shifts = ['Days', '1st', '2nd'] as const;
export const machines = ['FlexMaster', 'FlexiStar'];
export const downtimeReasons = [
  'None',
  'Sensor Fault',
  'Material Delay',
  'Changeover',
  'Maintenance',
  'Quality Check',
  'Staffing',
];

export const emptyEntry: ProductionEntry = {
  id: '',
  date: '2026-05-26',
  shift: 'Days',
  machine: 'FlexMaster',
  operatorName: '',
  shiftHours: 8.5,
  breakMinutes: 60,
  setupCount: 0,
  standardSetupMinutes: 20,
  actualSetupMinutes: 0,
  downtimeMinutes: 0,
  cycleTimeSeconds: 0,
  actualPipeQuantity: 0,
  scrapQuantity: 0,
  downtimeReason: 'None',
  notes: '',
};

export const sampleEntries: ProductionEntry[] = [
  {
    id: 'sample-2026-05-22-1',
    date: '2026-05-22',
    shift: 'Days',
    shiftHours: 8.5,
    breakMinutes: 60,
    setupCount: 4,
    standardSetupMinutes: 20,
    actualSetupMinutes: 26,
    downtimeMinutes: 28,
    cycleTimeSeconds: 32,
    actualPipeQuantity: 596,
    scrapQuantity: 12,
    downtimeReason: 'Sensor Fault',
    operatorName: '',
    machine: 'FlexMaster',
    notes: 'Required demo validation row.',
  },
  {
    id: 'sample-2026-05-26-1',
    date: '2026-05-26',
    shift: '1st',
    machine: 'FlexiStar',
    operatorName: '',
    shiftHours: 8.5,
    breakMinutes: 60,
    setupCount: 3,
    standardSetupMinutes: 20,
    actualSetupMinutes: 22,
    downtimeMinutes: 18,
    cycleTimeSeconds: 32,
    actualPipeQuantity: 620,
    scrapQuantity: 8,
    downtimeReason: 'None',
    notes: 'Simple example row for today. Delete or edit during testing.',
  },
];

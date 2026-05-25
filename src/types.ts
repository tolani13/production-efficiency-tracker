export type Shift = '1st' | '2nd' | '3rd' | 'Weekend';

export type ProductionEntry = {
  id: string;
  date: string;
  shift: Shift;
  machine: string;
  operatorName: string;
  shiftHours: number;
  breakMinutes: number;
  setupCount: number;
  standardSetupMinutes: number;
  actualSetupMinutes: number;
  downtimeMinutes: number;
  cycleTimeSeconds: number;
  actualPipeQuantity: number;
  scrapQuantity: number;
  downtimeReason: string;
  notes: string;
};

export type CalculatedEntry = {
  availableMinutes: number;
  standardSetupTotal: number;
  actualSetupTotal: number;
  runtimeAfterActualSetups: number;
  productiveRuntime: number;
  productiveRuntimeForSummary: number;
  theoreticalQuantity: number;
  setupEfficiency: number | null;
  runtimeAvailability: number | null;
  outputEfficiency: number | null;
  warnings: string[];
};

export type FilterState = {
  from: string;
  to: string;
  shift: string;
  machine: string;
  operatorName: string;
};

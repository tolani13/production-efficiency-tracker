import type { CalculatedEntry, ProductionEntry } from './types';

const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

export function calculateEntry(entry: ProductionEntry): CalculatedEntry {
  const shiftHours = safeNumber(entry.shiftHours);
  const breakMinutes = safeNumber(entry.breakMinutes);
  const setupCount = safeNumber(entry.setupCount);
  const standardSetupMinutes = safeNumber(entry.standardSetupMinutes);
  const actualSetupMinutes = safeNumber(entry.actualSetupMinutes);
  const downtimeMinutes = safeNumber(entry.downtimeMinutes);
  const cycleTimeSeconds = safeNumber(entry.cycleTimeSeconds);
  const actualPipeQuantity = safeNumber(entry.actualPipeQuantity);

  const availableMinutes = shiftHours * 60 - breakMinutes;
  const standardSetupTotal = setupCount * standardSetupMinutes;
  const actualSetupTotal = setupCount * actualSetupMinutes;
  const runtimeAfterActualSetups = availableMinutes - actualSetupTotal;
  const productiveRuntime = runtimeAfterActualSetups - downtimeMinutes;
  const theoreticalQuantity =
    cycleTimeSeconds > 0
      ? Math.max(0, Math.round(((availableMinutes - standardSetupTotal) * 60) / cycleTimeSeconds))
      : 0;

  const setupEfficiency =
    setupCount === 0 ? 1 : actualSetupTotal > 0 ? standardSetupTotal / actualSetupTotal : null;
  const runtimeAvailability =
    runtimeAfterActualSetups > 0 ? Math.max(0, productiveRuntime) / runtimeAfterActualSetups : null;
  const outputEfficiency = theoreticalQuantity > 0 ? actualPipeQuantity / theoreticalQuantity : null;

  const warnings: string[] = [];
  if (availableMinutes <= 0) warnings.push('Available minutes are zero or negative.');
  if (cycleTimeSeconds <= 0) warnings.push('Cycle time is blank or zero, so theoretical quantity is 0.');
  if (setupCount < 0 || downtimeMinutes < 0 || actualPipeQuantity < 0) warnings.push('Negative values need review.');
  if (runtimeAfterActualSetups <= 0) warnings.push('Runtime after actual setups is zero or negative.');
  if (productiveRuntime < 0) warnings.push('Productive runtime is negative and is treated as 0 in summaries.');
  if (setupEfficiency !== null && setupEfficiency < 0.75) warnings.push('Setup efficiency is below 75%.');
  if (runtimeAvailability !== null && runtimeAvailability < 0.75) warnings.push('Runtime availability is below 75%.');
  if (outputEfficiency !== null && outputEfficiency < 0.75) warnings.push('Output efficiency is below 75%.');
  if (outputEfficiency !== null && outputEfficiency > 1.25) warnings.push('Output is more than 125% of theoretical quantity.');
  if (entry.scrapQuantity > entry.actualPipeQuantity * 0.12) warnings.push('Scrap quantity is unusually high.');

  return {
    availableMinutes,
    standardSetupTotal,
    actualSetupTotal,
    runtimeAfterActualSetups,
    productiveRuntime,
    productiveRuntimeForSummary: Math.max(0, productiveRuntime),
    theoreticalQuantity,
    setupEfficiency,
    runtimeAvailability,
    outputEfficiency,
    warnings,
  };
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

export function efficiencyClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'neutral';
  if (value >= 0.9) return 'good';
  if (value >= 0.75) return 'warn';
  return 'bad';
}

export function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

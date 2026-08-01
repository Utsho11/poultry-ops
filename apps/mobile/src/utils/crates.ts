export const EGGS_PER_CRATE = 30;

export function formatEggCount(totalEggs: number = 0): string {
  if (!totalEggs || totalEggs <= 0) return '0 Eggs';
  const crates = Math.floor(totalEggs / EGGS_PER_CRATE);
  const loose = totalEggs % EGGS_PER_CRATE;

  if (crates > 0 && loose > 0) {
    return `${crates} Crate${crates > 1 ? 's' : ''} ${loose} Egg${loose > 1 ? 's' : ''}`;
  }
  if (crates > 0) {
    return `${crates} Crate${crates > 1 ? 's' : ''}`;
  }
  return `${loose} Egg${loose > 1 ? 's' : ''}`;
}

export function cratesAndLooseToTotal(crates: number | string = 0, loose: number | string = 0): number {
  const c = Math.max(0, parseInt(String(crates), 10) || 0);
  const l = Math.max(0, parseInt(String(loose), 10) || 0);
  return c * EGGS_PER_CRATE + l;
}

export function totalToCratesAndLoose(totalEggs: number = 0): { crates: number; loose: number } {
  const total = Math.max(0, Math.floor(totalEggs));
  return {
    crates: Math.floor(total / EGGS_PER_CRATE),
    loose: total % EGGS_PER_CRATE
  };
}

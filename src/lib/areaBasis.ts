/**
 * Tipologie di superficie per sites.area_m2 (colonna sites.area_basis).
 * Terminologia immobiliare standard: la scelta dice all'utente QUALE metro
 * quadro inserire, e ai grafici quale base dichiarare nei kWh/m².
 */
export interface AreaBasisOption {
  value: string;
  label: string;
  hint: string;
}

export const AREA_BASIS_OPTIONS: AreaBasisOption[] = [
  {
    value: 'gross_building',
    label: 'Gross Building Area (GBA)',
    hint: 'Total constructed area, external walls included',
  },
  {
    value: 'gross_internal',
    label: 'Gross Internal Area (GIA)',
    hint: 'Area within external walls, all internal spaces',
  },
  {
    value: 'net_internal',
    label: 'Net Internal Area (NIA)',
    hint: 'Usable area excluding structure, cores and plant',
  },
  {
    value: 'net_leasable',
    label: 'Net Leasable Area (NLA)',
    hint: 'Rentable area, basis of most lease agreements',
  },
  {
    value: 'sales_area',
    label: 'Sales Area',
    hint: 'Customer-facing retail floor only',
  },
];

export function areaBasisLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return AREA_BASIS_OPTIONS.find(o => o.value === value)?.label ?? value;
}

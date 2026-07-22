export const DEFAULT_OPERATIONAL_COMPANIES = [['Resgate 116', 'RESGATE_116'], ['Auto Elite', 'AUTO_ELITE'], ['Help Go', 'HELP_GO']] as const
export function normalizeOperationalCompanyName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') }
export function normalizeOperationalCompanyCode(value: string) { return value.trim().toUpperCase().replace(/\s+/g, '_') }

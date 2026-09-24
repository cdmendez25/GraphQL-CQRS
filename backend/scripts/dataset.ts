/**
 * Excel guardó algunas concentraciones tópicas como fracción (0.05 = 5 %).
 * Se restauran a porcentaje legible; el resto de dosis se deja igual.
 */
export function normalizeDosage(raw: string): string {
  const value = raw.trim();
  if (!/^0\.\d+$/.test(value)) return value;
  const percent = Number((Number(value) * 100).toFixed(4));
  return `${String(percent).replace('.', ',')} %`;
}

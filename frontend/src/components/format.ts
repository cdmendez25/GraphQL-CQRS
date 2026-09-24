const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** El scalar Money llega como string decimal ("9500.00"). */
export const formatMoney = (value: string | number) => cop.format(Number(value));

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'medium' });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-CO');

export const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Multiplica un Money por una cantidad sin errores de punto flotante. */
export const multiplyMoney = (value: string, quantity: number) => ((Math.round(Number(value) * 100) * quantity) / 100).toFixed(2);

export const sumMoney = (values: string[]) =>
  (values.reduce((sum, value) => sum + Math.round(Number(value) * 100), 0) / 100).toFixed(2);

import { DomainErrors, type DomainError } from './errors.js';

export interface PrescriptionInput {
  doctorName: string;
  doctorLicense: string;
  prescriptionCode: string;
  /** YYYY-MM-DD (ya validado por el scalar Date). */
  issuedAt: string;
}

/** Vigencia de una fórmula médica para dispensación. */
export const PRESCRIPTION_VALIDITY_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Validación síncrona de forma: se ejecuta dentro del comando checkoutCart. */
export function validatePrescription(input: PrescriptionInput, today: Date = new Date()): DomainError[] {
  const errors: DomainError[] = [];
  if (input.doctorName.trim().length < 3) {
    errors.push(DomainErrors.validation('prescription.doctorName', 'El nombre del médico es obligatorio.'));
  }
  if (!/^\d{4,10}$/.test(input.doctorLicense.trim())) {
    errors.push(DomainErrors.validation('prescription.doctorLicense', 'El registro médico debe tener entre 4 y 10 dígitos.'));
  }
  if (!/^[A-Za-z0-9-]{4,30}$/.test(input.prescriptionCode.trim())) {
    errors.push(
      DomainErrors.validation('prescription.prescriptionCode', 'El código de la fórmula debe tener 4 a 30 caracteres alfanuméricos.'),
    );
  }
  const issued = Date.parse(`${input.issuedAt}T00:00:00Z`);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (Number.isNaN(issued)) {
    errors.push(DomainErrors.validation('prescription.issuedAt', 'Fecha de emisión inválida.'));
  } else if (issued > todayUtc) {
    errors.push(DomainErrors.validation('prescription.issuedAt', 'La fecha de emisión no puede ser futura.'));
  } else if ((todayUtc - issued) / DAY_MS > PRESCRIPTION_VALIDITY_DAYS) {
    errors.push(
      DomainErrors.validation('prescription.issuedAt', `La fórmula venció: tiene más de ${PRESCRIPTION_VALIDITY_DAYS} días.`),
    );
  }
  return errors;
}

/**
 * Simulación de la consulta asíncrona al registro nacional de talento humano
 * en salud (ReTHUS). Regla de la simulación: los registros que empiezan por
 * "0" no existen. Así la demo puede mostrar tanto el flujo feliz como el rechazo.
 */
export function verifyDoctorLicense(license: string): { valid: true } | { valid: false; reason: string } {
  return license.startsWith('0')
    ? { valid: false, reason: `El registro médico ${license} no aparece en ReTHUS.` }
    : { valid: true };
}

import { describe, expect, it } from 'vitest';
import { canTransition, checkTransition, findStockShortages, linesRequiringPrescription, orderTotal, type OrderLineDraft } from '../src/write/domain/order.js';
import { validatePrescription, verifyDoctorLicense } from '../src/write/domain/prescription.js';
import { MoneyScalar, PositiveIntScalar, DateScalar } from '../src/shared/scalars.js';
import { normalizeDosage } from '../scripts/dataset.js';

const line = (over: Partial<OrderLineDraft>): OrderLineDraft => ({
  medicationId: 1,
  name: 'Acetaminofén Forte',
  presentation: 'Caja x 20 tabletas',
  quantity: 1,
  unitPrice: '9500.00',
  requiresPrescription: false,
  ...over,
});

describe('Máquina de estados del pedido', () => {
  it('permite el flujo feliz PENDING_APPROVAL → APPROVED → DISPATCHED', () => {
    expect(canTransition('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransition('APPROVED', 'DISPATCHED')).toBe(true);
  });

  it('permite cancelar antes del despacho', () => {
    expect(canTransition('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
    expect(canTransition('APPROVED', 'CANCELLED')).toBe(true);
  });

  it('rechaza saltos de estado y cambios sobre estados finales', () => {
    expect(checkTransition('PENDING_APPROVAL', 'DISPATCHED')).toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    expect(checkTransition('DISPATCHED', 'CANCELLED')).toMatchObject({ from: 'DISPATCHED', to: 'CANCELLED' });
    expect(checkTransition('CANCELLED', 'APPROVED')).not.toBeNull();
  });
});

describe('Invariantes del checkout', () => {
  it('calcula el total en centavos sin errores de punto flotante', () => {
    expect(orderTotal([line({ unitPrice: '0.10', quantity: 3 }), line({ unitPrice: '0.20', quantity: 1 })])).toBe('0.50');
    expect(orderTotal([line({ unitPrice: '9500.00', quantity: 2 }), line({ unitPrice: '46000.00', quantity: 1 })])).toBe('65000.00');
  });

  it('detecta los medicamentos que exigen fórmula', () => {
    const lines = [line({ medicationId: 1 }), line({ medicationId: 3, requiresPrescription: true })];
    expect(linesRequiringPrescription(lines).map((l) => l.medicationId)).toEqual([3]);
  });

  it('reporta TODOS los ítems sin stock suficiente', () => {
    const lines = [line({ medicationId: 1, quantity: 5 }), line({ medicationId: 2, quantity: 2 }), line({ medicationId: 3, quantity: 1 })];
    const errors = findStockShortages(lines, new Map([[1, 4], [2, 2], [3, 0]]));
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({ code: 'OUT_OF_STOCK', medicationId: 1, requested: 5, available: 4 });
    expect(errors[1]).toMatchObject({ medicationId: 3, available: 0 });
  });
});

describe('Fórmula médica', () => {
  const today = new Date('2026-09-24T12:00:00Z');
  const valid = { doctorName: 'Dra. Camila Rojas', doctorLicense: '123456', prescriptionCode: 'RX-2026-0001', issuedAt: '2026-09-20' };

  it('acepta una fórmula vigente y bien formada', () => {
    expect(validatePrescription(valid, today)).toEqual([]);
  });

  it('rechaza fórmulas futuras o vencidas (más de 30 días)', () => {
    expect(validatePrescription({ ...valid, issuedAt: '2026-09-25' }, today)[0]).toMatchObject({ field: 'prescription.issuedAt' });
    expect(validatePrescription({ ...valid, issuedAt: '2026-08-01' }, today)[0].message).toMatch(/venció/);
  });

  it('valida registro médico y código', () => {
    const errors = validatePrescription({ ...valid, doctorLicense: 'AB', prescriptionCode: '!' }, today);
    expect(errors.map((e) => (e.kind === 'ValidationError' ? e.field : ''))).toEqual([
      'prescription.doctorLicense',
      'prescription.prescriptionCode',
    ]);
  });

  it('simula la verificación en ReTHUS', () => {
    expect(verifyDoctorLicense('123456')).toEqual({ valid: true });
    expect(verifyDoctorLicense('012345')).toMatchObject({ valid: false });
  });
});

describe('Scalars personalizados', () => {
  it('Money normaliza a 2 decimales y rechaza negativos', () => {
    expect(MoneyScalar.parseValue('9500')).toBe('9500.00');
    expect(MoneyScalar.serialize('46000.5')).toBe('46000.50');
    expect(() => MoneyScalar.parseValue('-1')).toThrow(/Money inválido/);
  });

  it('PositiveInt rechaza 0 y decimales', () => {
    expect(PositiveIntScalar.parseValue(3)).toBe(3);
    expect(() => PositiveIntScalar.parseValue(0)).toThrow();
    expect(() => PositiveIntScalar.parseValue(1.5)).toThrow();
  });

  it('Date exige fechas reales YYYY-MM-DD', () => {
    expect(DateScalar.parseValue('2026-02-28')).toBe('2026-02-28');
    expect(() => DateScalar.parseValue('2026-02-30')).toThrow();
  });
});

describe('Dataset', () => {
  it('restaura concentraciones que Excel convirtió en fracción', () => {
    expect(normalizeDosage('0.05')).toBe('5 %');
    expect(normalizeDosage('0.001')).toBe('0,1 %');
    expect(normalizeDosage('500 mg')).toBe('500 mg');
  });
});

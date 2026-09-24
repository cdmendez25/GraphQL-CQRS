import type { DomainErrorFieldsFragment } from '../gql/graphql';

/** Explicación extra según el tipo concreto del error (__typename). */
function detail(error: DomainErrorFieldsFragment): string | null {
  switch (error.__typename) {
    case 'OutOfStockError':
      return `Disponibles: ${error.available} · solicitadas: ${error.requested}`;
    case 'PrescriptionRequiredError':
      return 'Adjunta los datos de la fórmula médica para continuar.';
    case 'InvalidStateTransitionError':
      return `Transición no permitida: ${error.from} → ${error.to}`;
    default:
      return null;
  }
}

/** Muestra los errores de dominio tipados que devuelven los payloads de las mutations. */
export function DomainErrors({ errors }: { errors: readonly DomainErrorFieldsFragment[] | null | undefined }) {
  if (!errors?.length) return null;
  return (
    <div className="alert alert-error" role="alert">
      <ul>
        {errors.map((error, index) => (
          <li key={`${error.code}-${index}`}>
            <strong>{error.message}</strong>
            {detail(error) && <small>{detail(error)}</small>}
            <code className="error-code">{error.__typename}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Errores de red / GraphQL (no de negocio). */
export function RequestError({ error }: { error: { message: string } | undefined | null }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      No se pudo completar la solicitud: {error.message}
    </div>
  );
}

export function fieldErrors(errors: readonly DomainErrorFieldsFragment[] | null | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const error of errors ?? []) {
    if (error.__typename === 'ValidationError') result[error.field] = error.message;
  }
  return result;
}

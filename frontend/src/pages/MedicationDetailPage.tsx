import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AddToCartButton } from '../components/AddToCartButton';
import { RequestError } from '../components/DomainErrors';
import { formatDateTime, formatMoney } from '../components/format';
import { RxTag, StockBadge } from '../components/StatusBadge';
import { MEDICATION_DETAIL_QUERY } from '../graphql/operations';

/** Escenario A · ficha técnica: aquí sí se piden laboratorio, principio activo e indicaciones. */
export function MedicationDetailPage() {
  const { id = '' } = useParams();
  const [quantity, setQuantity] = useState(1);
  const { data, loading, error } = useQuery(MEDICATION_DETAIL_QUERY, { variables: { id } });
  const medication = data?.medication;

  if (loading && !medication) return <div className="card skeleton detail-skeleton" />;
  if (error) return <RequestError error={error} />;
  if (!medication) return <div className="empty card">Este medicamento no existe.</div>;

  const related = medication.category.medications.filter((other) => other.id !== medication.id).slice(0, 4);

  return (
    <section>
      <Link to="/" className="back">
        ← Volver al catálogo
      </Link>
      <div className="detail card">
        <div className="detail-main">
          <div className="med-card-tags">
            <StockBadge status={medication.stockStatus} />
            {medication.requiresPrescription && <RxTag />}
          </div>
          <h1>{medication.name}</h1>
          <p className="lead">{medication.indications}</p>

          <dl className="facts">
            <div>
              <dt>Principio activo</dt>
              <dd>{medication.activeIngredient.name}</dd>
            </div>
            <div>
              <dt>Concentración</dt>
              <dd>{medication.dosage}</dd>
            </div>
            <div>
              <dt>Presentación</dt>
              <dd>{medication.presentation}</dd>
            </div>
            <div>
              <dt>Laboratorio</dt>
              <dd>{medication.laboratory.name}</dd>
            </div>
            <div>
              <dt>Categoría terapéutica</dt>
              <dd>{medication.category.name}</dd>
            </div>
            <div>
              <dt>SKU</dt>
              <dd>
                <code>{medication.sku}</code>
              </dd>
            </div>
          </dl>

          {medication.requiresPrescription && (
            <div className="alert alert-info">
              Este medicamento requiere <strong>fórmula médica</strong>. Al confirmar el pedido te pediremos el nombre y registro del
              médico, el código y la fecha de la fórmula (vigencia máxima de 30 días).
            </div>
          )}
        </div>

        <aside className="detail-buy">
          <span className="price price-lg">{formatMoney(medication.price)}</span>
          <p className="muted">
            {medication.stockAvailable} unidades disponibles
            <br />
            <small>Stock proyectado · {formatDateTime(medication.updatedAt)}</small>
          </p>
          <label className="field">
            <span>Cantidad</span>
            <input
              className="input"
              type="number"
              min={1}
              max={Math.max(1, medication.stockAvailable)}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <AddToCartButton medicationId={medication.id} quantity={quantity} disabled={medication.stockAvailable === 0} />
        </aside>
      </div>

      {related.length > 0 && (
        <>
          <h2 className="section-title">Más en {medication.category.name}</h2>
          <div className="grid grid-compact">
            {related.map((other) => (
              <Link key={other.id} to={`/medications/${other.id}`} className="card related">
                <strong>{other.name}</strong>
                <span className="muted">{other.presentation}</span>
                <span className="price">{formatMoney(other.price)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

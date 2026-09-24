import { NetworkStatus } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AddToCartButton } from '../components/AddToCartButton';
import { RequestError } from '../components/DomainErrors';
import { formatMoney } from '../components/format';
import { RxTag, StockBadge } from '../components/StatusBadge';
import type { MedicationCardFragment, MedicationSortField, SortDirection } from '../gql/graphql';
import { CATALOG_QUERY, CATEGORIES_QUERY } from '../graphql/operations';

const SORTS: Record<string, { label: string; field: MedicationSortField; direction: SortDirection }> = {
  'NAME-ASC': { label: 'Nombre (A-Z)', field: 'NAME', direction: 'ASC' },
  'PRICE-ASC': { label: 'Precio: menor a mayor', field: 'PRICE', direction: 'ASC' },
  'PRICE-DESC': { label: 'Precio: mayor a menor', field: 'PRICE', direction: 'DESC' },
};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function MedicationCard({ medication }: { medication: MedicationCardFragment }) {
  return (
    <article className="card med-card">
      <Link to={`/medications/${medication.id}`} className="med-card-link">
        <div className="med-card-tags">
          <StockBadge status={medication.stockStatus} />
          {medication.requiresPrescription && <RxTag />}
        </div>
        <h3>{medication.name}</h3>
        <p className="muted">{medication.presentation}</p>
      </Link>
      <div className="med-card-footer">
        <span className="price">{formatMoney(medication.price)}</span>
        <AddToCartButton medicationId={medication.id} disabled={medication.stockStatus === 'OUT_OF_STOCK'} compact />
      </div>
    </article>
  );
}

/**
 * Escenario A · exploración eficiente. La query Catalog solo pide el fragmento
 * condensado (nombre, precio, presentación + 2 banderas): nada de indicaciones,
 * laboratorio ni principio activo → respuesta liviana para redes móviles.
 */
export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<'all' | 'otc' | 'rx'>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState('NAME-ASC');
  const debouncedSearch = useDebounced(search.trim(), 300);

  const variables = useMemo(
    () => ({
      first: 12,
      sort: { field: SORTS[sortKey].field, direction: SORTS[sortKey].direction },
      filter: {
        search: debouncedSearch || null,
        categoryIds: categoryId ? [categoryId] : null,
        requiresPrescription: prescription === 'all' ? null : prescription === 'rx',
        inStockOnly: inStockOnly || null,
      },
    }),
    [debouncedSearch, categoryId, prescription, inStockOnly, sortKey],
  );

  const { data, previousData, loading, error, fetchMore, networkStatus } = useQuery(CATALOG_QUERY, {
    variables,
    notifyOnNetworkStatusChange: true,
  });
  const { data: categories } = useQuery(CATEGORIES_QUERY);

  const connection = (data ?? previousData)?.medications;
  const loadingMore = networkStatus === NetworkStatus.fetchMore;

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Catálogo de medicamentos</h1>
          <p className="muted">
            {connection ? `${connection.totalCount} resultado(s)` : 'Cargando…'} · busca por nombre comercial, principio activo o categoría
          </p>
        </div>
      </div>

      <div className="filters card">
        <input
          className="input search"
          type="search"
          placeholder="Ej. ibuprofeno, antibióticos, Losartán…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Buscar medicamentos"
        />
        <select className="input" value={prescription} onChange={(event) => setPrescription(event.target.value as typeof prescription)}>
          <option value="all">Todos</option>
          <option value="otc">Venta libre (OTC)</option>
          <option value="rx">Con fórmula médica</option>
        </select>
        <select className="input" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
          {Object.entries(SORTS).map(([key, sort]) => (
            <option key={key} value={key}>
              {sort.label}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} />
          Solo con stock
        </label>
      </div>

      <div className="chips" role="group" aria-label="Categoría terapéutica">
        <button className={`chip ${categoryId === null ? 'chip-active' : ''}`} onClick={() => setCategoryId(null)}>
          Todas
        </button>
        {categories?.therapeuticCategories.map((category) => (
          <button
            key={category.id}
            className={`chip ${categoryId === category.id ? 'chip-active' : ''}`}
            onClick={() => setCategoryId(category.id === categoryId ? null : category.id)}
          >
            {category.name} <small>{category.medicationCount}</small>
          </button>
        ))}
      </div>

      <RequestError error={error} />

      {!connection && loading ? (
        <div className="grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="card med-card skeleton" />
          ))}
        </div>
      ) : connection?.edges.length === 0 ? (
        <div className="empty card">No encontramos medicamentos con esos filtros.</div>
      ) : (
        <div className={`grid ${loading && !loadingMore ? 'is-refreshing' : ''}`}>
          {connection?.edges.map(({ node }) => <MedicationCard key={node.id} medication={node} />)}
        </div>
      )}

      {connection?.pageInfo.hasNextPage && (
        <div className="center">
          <button
            className="btn btn-secondary"
            disabled={loadingMore}
            onClick={() => fetchMore({ variables: { after: connection.pageInfo.endCursor } })}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}
    </section>
  );
}

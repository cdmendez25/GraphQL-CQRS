-- =====================================================================
-- 002 · READ MODEL (lado de consultas · CQRS)
-- Proyecciones desnormalizadas, optimizadas para las pantallas.
-- Solo el proyector (backend/src/projections) escribe aquí; las Queries
-- de GraphQL solo leen de estas tablas.
-- =====================================================================

-- Catálogo: una fila por medicamento con todo lo que la exploración
-- necesita, sin JOINs en tiempo de consulta.
create table if not exists catalog_projection (
  medication_id          integer primary key,
  sku                    text not null,
  commercial_name        text not null,
  active_ingredient_id   integer not null,
  active_ingredient      text not null,
  category_id            integer not null,
  category               text not null,
  category_slug          text not null,
  laboratory_id          integer not null,
  laboratory             text not null,
  dosage                 text not null,
  presentation           text not null,
  price                  numeric(12, 2) not null,
  requires_prescription  boolean not null,
  description            text not null,
  stock_available        integer not null,
  -- texto normalizado (minúsculas, sin tildes) para búsqueda por
  -- nombre comercial, principio activo o categoría terapéutica
  search_text            text not null,
  last_event_id          bigint not null default 0,
  updated_at             timestamptz not null default now()
);

-- Resumen de pedido: lo que ve el paciente y el farmacéutico.
create table if not exists order_summary_projection (
  order_id               uuid primary key,
  patient_id             uuid not null,
  patient_name           text not null,
  status                 order_status not null,
  status_reason          text,
  total                  numeric(12, 2) not null,
  item_count             integer not null,
  items                  jsonb not null,           -- [{ medicationId, name, presentation, quantity, unitPrice, requiresPrescription }]
  requires_prescription  boolean not null,
  prescription           jsonb,                    -- { doctorName, doctorLicense, code, issuedAt, status, notes }
  projection_version     integer not null,         -- = versión del agregado Order proyectada
  last_event_id          bigint not null,
  placed_at              timestamptz not null,
  updated_at             timestamptz not null default now()
);

-- Checkpoint del proyector: último evento aplicado (permite reanudar
-- tras un reinicio y reconstruir proyecciones desde cero).
create table if not exists projection_checkpoints (
  projection     text primary key,
  last_event_id  bigint not null default 0,
  updated_at     timestamptz not null default now()
);

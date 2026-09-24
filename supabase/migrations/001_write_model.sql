-- =====================================================================
-- 001 · WRITE MODEL (lado de comandos · CQRS)
-- Modelo normalizado y transaccional. Solo los command handlers del
-- backend escriben aquí. Las pantallas NUNCA leen estas tablas
-- directamente: se alimentan de las proyecciones (002_read_model.sql).
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------- Enums de dominio -----------------------------------------
do $$ begin
  create type order_status as enum ('PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  -- PENDING_REVIEW: recibida, sin verificar
  -- AUTO_VERIFIED : el verificador asíncrono confirmó el registro médico
  -- APPROVED      : el químico farmacéutico aprobó la fórmula
  -- REJECTED      : fórmula inválida → la orden se cancela
  create type prescription_status as enum ('PENDING_REVIEW', 'AUTO_VERIFIED', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('PATIENT', 'PHARMACIST');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cart_status as enum ('OPEN', 'CHECKED_OUT');
exception when duplicate_object then null; end $$;

-- ---------- Datos maestros del catálogo ------------------------------
create table if not exists laboratories (
  id         serial primary key,
  name       text not null unique
);

create table if not exists therapeutic_categories (
  id         serial primary key,
  name       text not null unique,
  slug       text not null unique
);

create table if not exists active_ingredients (
  id         serial primary key,
  name       text not null unique
);

create table if not exists medications (
  id                    integer primary key,               -- se conserva el id del dataset
  sku                   text not null unique check (sku ~ '^MED-[0-9]{3}$'),
  commercial_name       text not null,
  active_ingredient_id  integer not null references active_ingredients (id),
  category_id           integer not null references therapeutic_categories (id),
  laboratory_id         integer not null references laboratories (id),
  dosage                text not null,
  presentation          text not null,
  price                 numeric(12, 2) not null check (price >= 0),
  requires_prescription boolean not null default false,
  description           text not null,
  created_at            timestamptz not null default now()
);

-- Inventario separado del catálogo: es la tabla "caliente" de escritura.
--   available = unidades que se pueden vender
--   reserved  = unidades apartadas por órdenes aún no despachadas
create table if not exists inventory (
  medication_id integer primary key references medications (id),
  available     integer not null check (available >= 0),
  reserved      integer not null default 0 check (reserved >= 0),
  version       integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- ---------- Usuarios --------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text not null,
  password_hash text not null,
  role          user_role not null default 'PATIENT',
  created_at    timestamptz not null default now()
);

-- ---------- Carrito (agregado de escritura) ---------------------------
create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references users (id),
  status      cart_status not null default 'OPEN',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists cart_items (
  cart_id       uuid not null references carts (id) on delete cascade,
  medication_id integer not null references medications (id),
  quantity      integer not null check (quantity > 0),
  added_at      timestamptz not null default now(),
  primary key (cart_id, medication_id)
);

-- ---------- Órdenes ----------------------------------------------------
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references users (id),
  cart_id        uuid references carts (id),
  status         order_status not null default 'PENDING_APPROVAL',
  status_reason  text,
  total          numeric(12, 2) not null check (total >= 0),
  version        integer not null default 1,          -- concurrencia optimista / versión de agregado
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists order_items (
  order_id              uuid not null references orders (id) on delete cascade,
  medication_id         integer not null references medications (id),
  quantity              integer not null check (quantity > 0),
  unit_price            numeric(12, 2) not null check (unit_price >= 0),   -- precio congelado al comprar
  requires_prescription boolean not null,
  primary key (order_id, medication_id)
);

create table if not exists prescriptions (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null unique references orders (id) on delete cascade,
  doctor_name       text not null,
  doctor_license    text not null,
  prescription_code text not null,
  issued_at         date not null,
  status            prescription_status not null default 'PENDING_REVIEW',
  review_notes      text,
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz
);

-- ---------- Event log / Outbox ---------------------------------------
-- Cada comando registra aquí sus eventos de dominio EN LA MISMA
-- transacción que modifica el estado. El proyector los consume de forma
-- asíncrona para actualizar el read model (consistencia eventual).
create table if not exists domain_events (
  id              bigserial primary key,
  aggregate_type  text not null,
  aggregate_id    text not null,
  event_type      text not null,
  payload         jsonb not null,
  occurred_at     timestamptz not null default now()
);

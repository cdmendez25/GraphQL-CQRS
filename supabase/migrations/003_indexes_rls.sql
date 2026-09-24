-- =====================================================================
-- 003 · ÍNDICES + SEGURIDAD
-- =====================================================================

-- ---------- Write model: FKs y accesos de los comandos ----------------
create index if not exists idx_medications_active_ingredient on medications (active_ingredient_id);
create index if not exists idx_medications_category          on medications (category_id);
create index if not exists idx_medications_laboratory        on medications (laboratory_id);
create index if not exists idx_cart_items_medication         on cart_items (medication_id);
create index if not exists idx_order_items_medication        on order_items (medication_id);
create index if not exists idx_orders_patient_created        on orders (patient_id, created_at desc);
create index if not exists idx_orders_status                 on orders (status);
create index if not exists idx_domain_events_aggregate       on domain_events (aggregate_type, aggregate_id);

-- Un paciente solo puede tener un carrito abierto a la vez.
create unique index if not exists uq_carts_one_open_per_patient on carts (patient_id) where status = 'OPEN';

-- ---------- Read model: búsqueda facetada del catálogo ---------------
-- Búsqueda parcial (ILIKE '%texto%') acelerada con trigramas.
create index if not exists idx_catalog_search_trgm   on catalog_projection using gin (search_text gin_trgm_ops);
-- Filtros y ordenamientos (paginación por cursor keyset: (col, id)).
create index if not exists idx_catalog_category      on catalog_projection (category_id);
create index if not exists idx_catalog_laboratory    on catalog_projection (laboratory_id);
create index if not exists idx_catalog_ingredient    on catalog_projection (active_ingredient_id);
create index if not exists idx_catalog_name_id       on catalog_projection (commercial_name, medication_id);
create index if not exists idx_catalog_price_id      on catalog_projection (price, medication_id);

-- Pedidos: "mis pedidos" y cola del farmacéutico.
create index if not exists idx_order_proj_patient    on order_summary_projection (patient_id, placed_at desc);
create index if not exists idx_order_proj_status     on order_summary_projection (status, placed_at);

-- ---------- Seguridad (Zero-REST también en Supabase) -----------------
-- Supabase expone automáticamente una API REST (PostgREST) sobre el
-- esquema public. Activamos RLS SIN políticas: con la anon key no se
-- puede leer ni escribir nada por REST. El único acceso es el backend
-- GraphQL, que se conecta por protocolo PostgreSQL con el rol dueño.
alter table laboratories              enable row level security;
alter table therapeutic_categories    enable row level security;
alter table active_ingredients        enable row level security;
alter table medications               enable row level security;
alter table inventory                 enable row level security;
alter table users                     enable row level security;
alter table carts                     enable row level security;
alter table cart_items                enable row level security;
alter table orders                    enable row level security;
alter table order_items               enable row level security;
alter table prescriptions             enable row level security;
alter table domain_events             enable row level security;
alter table catalog_projection        enable row level security;
alter table order_summary_projection  enable row level security;
alter table projection_checkpoints    enable row level security;

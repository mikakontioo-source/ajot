create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  route text,
  trip_type text default 'työajo',
  start_odometer integer not null,
  end_odometer integer,
  distance integer,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trips_started_at_idx on trips(started_at desc);
create index if not exists trips_status_idx on trips(status);

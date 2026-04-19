-- Run once against your PostgreSQL database:
--   psql $DATABASE_URL -f db/migrate.sql

-- ── Custom ENUMs ──────────────────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('admin', 'technician');
CREATE TYPE compound_type   AS ENUM ('sterile', 'non-sterile', 'hazardous');
CREATE TYPE compound_unit   AS ENUM ('g', 'mL', 'caps', 'tabs', 'units');
CREATE TYPE compound_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE activity_action AS ENUM ('created', 'approved', 'rejected',
                                     'adjusted_bud', 'removed');

-- ── users ──────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          user_role     NOT NULL DEFAULT 'technician',
  created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── compounds ─────────────────────────────────────────────────────────────────
CREATE TABLE compounds (
  id                   SERIAL PRIMARY KEY,
  name                 VARCHAR(255)    NOT NULL,
  strength             VARCHAR(100)    NOT NULL,
  type                 compound_type   NOT NULL,
  lot_number           VARCHAR(100)    UNIQUE NOT NULL,
  quantity             NUMERIC(10,3)   NOT NULL,
  unit                 compound_unit   NOT NULL,
  date_made            DATE            NOT NULL,
  bud                  DATE            NOT NULL,
  bud_override_reason  TEXT,
  bud_overridden_by    INT REFERENCES users(id),
  bud_overridden_at    TIMESTAMP,
  notes                TEXT,
  status               compound_status NOT NULL DEFAULT 'pending',
  created_by           INT NOT NULL REFERENCES users(id),
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_by          INT REFERENCES users(id),
  approved_at          TIMESTAMP,
  rejected_by          INT REFERENCES users(id),
  rejected_at          TIMESTAMP,
  rejection_note       TEXT
);

-- ── ingredients ───────────────────────────────────────────────────────────────
CREATE TABLE ingredients (
  id                  SERIAL PRIMARY KEY,
  compound_id         INT NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  drug_name           VARCHAR(255) NOT NULL,
  strength            VARCHAR(100),
  supplier_lot_number VARCHAR(100),
  expiration_date     DATE
);

-- ── activity_log ──────────────────────────────────────────────────────────────
CREATE TABLE activity_log (
  id          SERIAL PRIMARY KEY,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id     INT NOT NULL REFERENCES users(id),
  action      activity_action NOT NULL,
  compound_id INT NOT NULL REFERENCES compounds(id),
  notes       TEXT
);

-- ── indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_compounds_status    ON compounds(status);
CREATE INDEX idx_compounds_bud       ON compounds(bud);
CREATE INDEX idx_activity_compound   ON activity_log(compound_id);
CREATE INDEX idx_activity_created_at ON activity_log(created_at DESC);

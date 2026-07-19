CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_uid VARCHAR(12) UNIQUE NOT NULL,
  connection_state VARCHAR(7) NOT NULL DEFAULT 'offline',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT devices_uid_format CHECK (device_uid ~ '^[0-9A-F]{12}$'),
  CONSTRAINT devices_connection_state CHECK (connection_state IN ('online', 'offline'))
);

CREATE TABLE IF NOT EXISTS sensor_data (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  temperature REAL,
  do_level REAL,
  ph_level REAL,
  solenoid_state VARCHAR(3),
  control_mode VARCHAR(10),
  rssi INTEGER,
  device_id INTEGER REFERENCES devices(id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE sensor_data ALTER COLUMN temperature DROP NOT NULL;
ALTER TABLE sensor_data ALTER COLUMN do_level DROP NOT NULL;
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS solenoid_state VARCHAR(3);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS control_mode VARCHAR(10);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS rssi INTEGER;
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);

CREATE TABLE IF NOT EXISTS control_log (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  source VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE control_log ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'control_log' AND column_name = 'aerator'
  ) THEN
    ALTER TABLE control_log RENAME COLUMN aerator TO action;
  END IF;
END$$;

ALTER TABLE control_log ALTER COLUMN action TYPE VARCHAR(20);

CREATE TABLE IF NOT EXISTS pond_journal (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  entry_type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE pond_journal ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);

CREATE INDEX IF NOT EXISTS sensor_data_device_created_idx
  ON sensor_data (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pond_journal_device_created_idx
  ON pond_journal (device_id, created_at DESC);

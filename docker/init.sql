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
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS data_source VARCHAR(12);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_step VARCHAR(12);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_paused BOOLEAN;
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_revision BIGINT;
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS demo_session VARCHAR(16);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);

CREATE TABLE IF NOT EXISTS control_log (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  source VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE control_log ADD COLUMN IF NOT EXISTS device_id INTEGER REFERENCES devices(id);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS command_id UUID;
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS requested_mode VARCHAR(10);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS requested_solenoid VARCHAR(3);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS applied_mode VARCHAR(10);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS applied_solenoid VARCHAR(3);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS relay_pin_level SMALLINT;
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(100);
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE control_log ADD COLUMN IF NOT EXISTS timed_out_at TIMESTAMPTZ;

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
CREATE UNIQUE INDEX IF NOT EXISTS control_log_command_id_unique_idx
  ON control_log (command_id) WHERE command_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS control_log_one_inflight_per_device_idx
  ON control_log (device_id) WHERE status IN ('PENDING', 'SENT');

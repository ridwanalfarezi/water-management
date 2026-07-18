CREATE TABLE IF NOT EXISTS sensor_data (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  temperature REAL,
  do_level REAL,
  ph_level REAL,
  solenoid_state VARCHAR(3),
  control_mode VARCHAR(10),
  rssi INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE sensor_data ALTER COLUMN temperature DROP NOT NULL;
ALTER TABLE sensor_data ALTER COLUMN do_level DROP NOT NULL;
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS solenoid_state VARCHAR(3);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS control_mode VARCHAR(10);
ALTER TABLE sensor_data ADD COLUMN IF NOT EXISTS rssi INTEGER;

CREATE TABLE IF NOT EXISTS control_log (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  source VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS pond_journal (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  entry_type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_data (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  temperature REAL NOT NULL,
  do_level REAL NOT NULL,
  ph_level REAL,
  created_at TIMESTAMP DEFAULT NOW()
);

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

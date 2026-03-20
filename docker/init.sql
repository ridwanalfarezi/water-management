CREATE TABLE IF NOT EXISTS sensor_data (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  temperature REAL NOT NULL,
  do_level REAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_log (
  id SERIAL PRIMARY KEY,
  pond_id INTEGER NOT NULL,
  aerator VARCHAR(10) NOT NULL,
  source VARCHAR(20) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT NOW()
);

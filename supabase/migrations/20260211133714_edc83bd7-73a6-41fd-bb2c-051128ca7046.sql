
-- Add module configuration columns to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_energy_enabled BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_energy_show_demo BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_air_enabled BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_air_show_demo BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_water_enabled BOOLEAN DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS module_water_show_demo BOOLEAN DEFAULT false;

-- Figuurbank: gedeelde, blijvende opslag van goedgekeurde figuren (go van de keuring).
-- Elke docent hergebruikt een figuur direct als de spec exact overeenkomt.
-- Items zijn onveranderlijk: alleen INSERT ... ON CONFLICT DO NOTHING; UPDATE/DELETE worden geweigerd.
CREATE TABLE IF NOT EXISTS figuur_bank (
  sleutel      TEXT PRIMARY KEY,          -- sha256 van de canonieke spec (zonder vrije 'doel'-tekst)
  figuur_hash  TEXT NOT NULL,             -- sha256 van de goedgekeurde figuur (zelfde als GoedgekeurdeFiguur.hash)
  figuur_id    TEXT NOT NULL,
  soort        TEXT NOT NULL,
  bron         TEXT NOT NULL,             -- 'code' | 'ai'
  mime         TEXT NOT NULL,
  data         TEXT NOT NULL,             -- base64 van precies de gekeurde bytes
  breedte      INTEGER NOT NULL,
  hoogte       INTEGER NOT NULL,
  alt          TEXT NOT NULL,
  spec         JSONB NOT NULL,
  pogingen     INTEGER NOT NULL,
  go_rapport   JSONB NOT NULL,            -- { keuring, log }
  aangemaakt   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION figuur_bank_onveranderlijk() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'figuur_bank is onveranderlijk (alleen toevoegen)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS figuur_bank_geen_wijziging ON figuur_bank;
CREATE TRIGGER figuur_bank_geen_wijziging
  BEFORE UPDATE OR DELETE ON figuur_bank
  FOR EACH ROW EXECUTE FUNCTION figuur_bank_onveranderlijk();

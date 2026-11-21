-- Holidays / special periods per instance (RF: feriados e horários especiais)
ALTER TABLE "Instance" ADD COLUMN "exceptions" JSONB NOT NULL DEFAULT '[]';

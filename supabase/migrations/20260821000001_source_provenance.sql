-- Migration: 20260821000001_source_provenance.sql
-- Description: Add source provenance, PDF rules link, and multi-source conflict tracking

ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS source_name TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'official',
ADD COLUMN IF NOT EXISTS official_source_url TEXT,
ADD COLUMN IF NOT EXISTS rules_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS source_conflict BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for source provenance and conflict auditing
CREATE INDEX IF NOT EXISTS idx_opportunities_source_type ON public.opportunities(source_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_source_conflict ON public.opportunities(source_conflict);

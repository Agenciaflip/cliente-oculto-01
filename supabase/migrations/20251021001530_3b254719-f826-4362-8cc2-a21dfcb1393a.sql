-- Adicionar novo status 'pending_follow_up' ao enum analysis_status
ALTER TYPE analysis_status ADD VALUE IF NOT EXISTS 'pending_follow_up';
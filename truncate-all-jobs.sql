-- Truncate all job-related tables in the correct order to respect foreign key constraints

-- First, disable foreign key checks temporarily (if needed)
BEGIN;

-- Delete all data from dependent tables first
DELETE FROM llm_calls;
DELETE FROM expert_request_matches;
DELETE FROM expert_sourcing_raw_outputs;

-- Delete from main tables
DELETE FROM experts;
DELETE FROM expert_sourcing_requests;

-- Reset sequences if needed
-- ALTER SEQUENCE expert_sourcing_requests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE experts_id_seq RESTART WITH 1;

COMMIT;

-- Verify the deletion
SELECT 'expert_sourcing_requests' as table_name, COUNT(*) as count FROM expert_sourcing_requests
UNION ALL
SELECT 'experts', COUNT(*) FROM experts
UNION ALL
SELECT 'expert_request_matches', COUNT(*) FROM expert_request_matches
UNION ALL
SELECT 'expert_sourcing_raw_outputs', COUNT(*) FROM expert_sourcing_raw_outputs
UNION ALL
SELECT 'llm_calls', COUNT(*) FROM llm_calls;
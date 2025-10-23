-- =====================================================
-- VALIDATION SCRIPT: Performance Indexes
-- Purpose: Verify indexes were created and check their usage
-- =====================================================

-- 1. List all indexes on main tables
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('analysis_requests', 'conversation_messages', 'profiles', 'user_roles', 'subscriptions', 'usage_tracking')
ORDER BY tablename, indexname;

-- 2. Check index sizes (to monitor disk usage)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Check index usage statistics (run after some production usage)
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN ('analysis_requests', 'conversation_messages', 'profiles')
ORDER BY idx_scan DESC;

-- 4. Find unused indexes (after 1 week of production)
-- If idx_scan = 0, the index might not be needed
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
    AND indexname NOT LIKE '%_pkey'  -- Exclude primary keys
ORDER BY pg_relation_size(indexrelid) DESC;

-- 5. Check table sizes before and after indexing
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('analysis_requests', 'conversation_messages', 'profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 6. Test query performance (example queries that should use indexes)
-- These will show if indexes are being used in EXPLAIN plans

EXPLAIN ANALYZE
SELECT * FROM analysis_requests
WHERE status = 'chatting'
ORDER BY last_message_at DESC
LIMIT 20;

EXPLAIN ANALYZE
SELECT * FROM analysis_requests
WHERE user_id = '00000000-0000-0000-0000-000000000000'  -- Replace with real UUID
ORDER BY created_at DESC
LIMIT 20;

EXPLAIN ANALYZE
SELECT * FROM conversation_messages
WHERE analysis_id = '00000000-0000-0000-0000-000000000000'  -- Replace with real UUID
ORDER BY created_at;

-- 7. Check for missing indexes (suggestions)
-- This query identifies sequential scans that might benefit from indexes
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / seq_scan as avg_seq_tuples
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND seq_scan > 0
    AND tablename IN ('analysis_requests', 'conversation_messages', 'profiles')
ORDER BY seq_tup_read DESC;

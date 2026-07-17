// Test env — config.ts validates at first getConfig() call.
process.env.SUPABASE_URL ??= 'http://supabase.test';
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key-01234567890';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-key-01234567890';
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret-01234567890';
process.env.INTERNAL_API_KEY ??= 'test-internal-key-0123456789';
process.env.PARENT_ID_CHECK_URL ??= 'http://guardian.test';

// Test env — env.ts validates at the first getConfig() call.
process.env.INTERNAL_API_KEY ??= 'test-internal-key-0123456789';
process.env.IMAGE_API_KEY ??= 'test-image-key';
process.env.SUPABASE_URL ??= 'http://localhost:8000';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key-0123456789';
process.env.FILEBASE_URL ??= 'http://localhost:4006';
process.env.FILEBASE_INTERNAL_KEY ??= 'test-filebase-key-0123456789';

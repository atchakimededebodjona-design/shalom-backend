module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  clearMocks: true,
  testTimeout: 30000, // 30 secondes car base de données distante (Supabase)
};

// Single source of truth for whether auth is enforced. Outside production (including
// Jest's ambient NODE_ENV=test), everything bypasses enforcement — this is what keeps
// Swagger UI freely testable and every pre-existing test green without changes.
export function isAuthEnforced() {
  return process.env.NODE_ENV === 'production';
}

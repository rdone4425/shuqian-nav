const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLogins = new Map();

function getClientKey(request = null) {
  const connectingIp = request?.headers?.get("CF-Connecting-IP");
  if (connectingIp) {
    return connectingIp.trim();
  }

  const forwardedFor = request?.headers?.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

function getState(key, now) {
  const state = failedLogins.get(key);
  if (!state || (state.lockedUntil > 0 && state.lockedUntil <= now)) {
    failedLogins.delete(key);
    return { failures: 0, lockedUntil: 0 };
  }
  return state;
}

export function checkLoginRateLimit(request = null, now = Date.now()) {
  const key = getClientKey(request);
  const state = getState(key, now);

  if (state.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(request = null, now = Date.now()) {
  const key = getClientKey(request);
  const state = getState(key, now);
  const failures = state.failures + 1;

  if (failures >= MAX_FAILED_ATTEMPTS) {
    failedLogins.set(key, {
      failures: 0,
      lockedUntil: now + LOCKOUT_MS,
    });
    return;
  }

  failedLogins.set(key, { failures, lockedUntil: 0 });
}

export function recordLoginSuccess(request = null) {
  failedLogins.delete(getClientKey(request));
}

export function resetLoginRateLimiterForTests() {
  failedLogins.clear();
}

const MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCK_MS = 10 * 60 * 1_000;

export type LoginAttemptState = {
  failedCount: number;
  lockedUntil: number | null;
};

export function createLoginAttemptState(): LoginAttemptState {
  return {
    failedCount: 0,
    lockedUntil: null,
  };
}

export function recordFailedLoginAttempt(
  state: LoginAttemptState,
  now = Date.now(),
): LoginAttemptState {
  const failedCount = state.failedCount + 1;

  return {
    failedCount,
    lockedUntil:
      failedCount >= MAX_FAILED_ATTEMPTS ? now + LOGIN_LOCK_MS : state.lockedUntil,
  };
}

export function getLoginLockState(
  state: LoginAttemptState,
  now = Date.now(),
): { isLocked: boolean; remainingMs: number } {
  if (!state.lockedUntil || state.lockedUntil <= now) {
    return {
      isLocked: false,
      remainingMs: 0,
    };
  }

  return {
    isLocked: true,
    remainingMs: state.lockedUntil - now,
  };
}

export function resetLoginAttemptState(): LoginAttemptState {
  return createLoginAttemptState();
}

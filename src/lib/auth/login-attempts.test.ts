import { describe, expect, it } from "vitest";

import {
  createLoginAttemptState,
  getLoginLockState,
  recordFailedLoginAttempt,
} from "./login-attempts";

describe("login attempt limiter", () => {
  it("locks sign in for 10 minutes after five failed attempts", () => {
    let state = createLoginAttemptState();

    for (let i = 0; i < 5; i += 1) {
      state = recordFailedLoginAttempt(state, 1_000);
    }

    expect(getLoginLockState(state, 1_000)).toEqual({
      isLocked: true,
      remainingMs: 600_000,
    });
  });

  it("clears the lock after the cooldown passes", () => {
    let state = createLoginAttemptState();

    for (let i = 0; i < 5; i += 1) {
      state = recordFailedLoginAttempt(state, 1_000);
    }

    expect(getLoginLockState(state, 601_000)).toEqual({
      isLocked: false,
      remainingMs: 0,
    });
  });
});

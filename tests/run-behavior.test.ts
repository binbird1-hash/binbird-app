import assert from "node:assert/strict";
import test from "node:test";

import { deriveRunMenuState } from "../lib/run-state";
import { createBackNavigationGuard } from "../lib/navigation-lock";
import type { PlannedRunPayload } from "../lib/planned-run";
import type { RunSessionRecord } from "../lib/run-session";

test("End Run is hidden until the route has started", () => {
  const sampleJob = {
    id: "1",
    address: "123 Main St",
    lat: 0,
    lng: 0,
    job_type: "put_out" as const,
    bins: null,
    notes: null,
    client_name: null,
    photo_path: null,
    last_completed_on: null,
    assigned_to: null,
    day_of_week: null,
  };

  const plannedBefore: PlannedRunPayload = {
    start: { lat: 0, lng: 0 },
    end: { lat: 1, lng: 1 },
    jobs: [sampleJob],
    startAddress: "Depot",
    endAddress: "Depot",
    createdAt: new Date().toISOString(),
    hasStarted: false,
  };

  const stateBefore = deriveRunMenuState({ plannedRun: plannedBefore, runSession: null });
  assert.equal(stateBefore.showEndRun, false);

  const plannedAfter: PlannedRunPayload = { ...plannedBefore, hasStarted: true };
  const stateAfter = deriveRunMenuState({ plannedRun: plannedAfter, runSession: null });
  assert.equal(stateAfter.showEndRun, true);
});

test("Back navigation is suppressed while a run is active", () => {
  let pushCount = 0;
  let activeListener: (() => void) | undefined;

  const fakeWindow = {
    history: {
      pushState: (_data: unknown, _unused: string, _url?: string | null) => {
        pushCount += 1;
      },
    },
    location: { href: "/staff/route" },
    addEventListener: (_type: "popstate", listener: () => void) => {
      activeListener = listener;
    },
    removeEventListener: (_type: "popstate", _listener: () => void) => {
      activeListener = undefined;
    },
  } satisfies Parameters<typeof createBackNavigationGuard>[0];

  const cleanup = createBackNavigationGuard(fakeWindow, () => true);

  assert.ok(pushCount >= 1, "initial history push should occur when locking navigation");

  activeListener?.();
  assert.ok(pushCount >= 2, "popstate should trigger another history push");

  cleanup();
  const priorPushCount = pushCount;
  activeListener?.();
  assert.equal(pushCount, priorPushCount, "listener should be removed after cleanup");
});

test("Ending a run unlocks navigation and hides the End Run action", () => {
  let active = true;
  let unlockCalled = 0;
  let storedListener: (() => void) | undefined;

  const fakeWindow = {
    history: {
      pushState: (_data: unknown, _unused: string, _url?: string | null) => {},
    },
    location: { href: "/staff/route" },
    addEventListener: (_type: "popstate", listener: () => void) => {
      storedListener = listener;
    },
    removeEventListener: (_type: "popstate", _listener: () => void) => {
      storedListener = undefined;
    },
  } satisfies Parameters<typeof createBackNavigationGuard>[0];

  const cleanup = createBackNavigationGuard(
    fakeWindow,
    () => active,
    () => {
      unlockCalled += 1;
    }
  );

  assert.equal(unlockCalled, 0);
  const listener = storedListener;
  active = false;
  listener?.();
  assert.equal(unlockCalled, 1, "unlock callback should fire once the run ends");

  const endedSession: RunSessionRecord = {
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    totalJobs: 3,
    completedJobs: 3,
  };

  const menuState = deriveRunMenuState({ plannedRun: null, runSession: endedSession });
  assert.equal(menuState.showEndRun, false);
  assert.equal(menuState.lockNavigation, false);

  cleanup();
});

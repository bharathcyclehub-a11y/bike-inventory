// Offline cache for Tasks + SOP check-offs
// Stores data in localStorage, queues mutations for sync on reconnect

const TASK_CACHE_KEY = "bch:tasks";
const SOP_CACHE_KEY = "bch:sop-checkoffs";
const PENDING_KEY = "bch:pending-actions";

// ── Task Cache ──────────────────────────────────────

export function cacheTasksLocally(tasks: unknown[]) {
  try { localStorage.setItem(TASK_CACHE_KEY, JSON.stringify(tasks)); } catch {}
}

export function getCachedTasks(): unknown[] | null {
  try {
    const raw = localStorage.getItem(TASK_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── SOP Check-off Cache ─────────────────────────────

export function cacheSOPCheckOffsLocally(checkOffs: unknown[]) {
  try { localStorage.setItem(SOP_CACHE_KEY, JSON.stringify(checkOffs)); } catch {}
}

export function getCachedSOPCheckOffs(): unknown[] | null {
  try {
    const raw = localStorage.getItem(SOP_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Pending Actions Queue ───────────────────────────

interface PendingAction {
  type: "task_status" | "sop_checkoff";
  payload: Record<string, unknown>;
  timestamp: number;
}

export function queueOfflineAction(action: Omit<PendingAction, "timestamp">) {
  try {
    const pending: PendingAction[] = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    pending.push({ ...action, timestamp: Date.now() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {}
}

export function getPendingActions(): PendingAction[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
}

export function clearPendingActions() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}

// Called on page load when online — replays queued actions
export async function syncPendingActions() {
  const pending = getPendingActions();
  if (pending.length === 0) return;

  for (const action of pending) {
    try {
      if (action.type === "task_status") {
        await fetch(`/api/tasks/${action.payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.payload.status }),
        });
      }
      if (action.type === "sop_checkoff") {
        await fetch("/api/sops/compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });
      }
    } catch {
      // Network still down — stop trying, will retry next time
      break;
    }
  }
  clearPendingActions();
}

"use client";

const valueOrZero = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const normalizeQueueHealth = (queueHealth) => {
  const approved =
    queueHealth.approvedTotal ??
    queueHealth.approved ??
    valueOrZero(queueHealth.approvedProcessed) + valueOrZero(queueHealth.approvedUnprocessed);
  const scheduled =
    queueHealth.scheduled ??
    queueHealth.scheduledCount ??
    queueHealth.approvedUsed ??
    queueHealth.used ??
    queueHealth.finished;
  const runwayDays = queueHealth.runwayDays ?? queueHealth.approvedUnused ?? queueHealth.approvedProcessed;
  const lowQueueThreshold = valueOrZero(queueHealth.lowQueueThreshold || 3);
  const normalizedRunwayDays = valueOrZero(runwayDays);
  const isLow = Boolean(queueHealth.isLow ?? normalizedRunwayDays < lowQueueThreshold);

  return {
    approved: valueOrZero(approved),
    scheduled: valueOrZero(scheduled),
    runwayDays: normalizedRunwayDays,
    lowQueueThreshold,
    isLow,
  };
};

export default function QueueHealthPanel({ queueHealth }) {
  if (!queueHealth) {
    return null;
  }

  const health = normalizeQueueHealth(queueHealth);

  return (
    <section className={`admin-queue-health${health.isLow ? " is-low" : ""}`} aria-label="Admin queue health">
      <div className="admin-queue-health-header">
        <div>
          <p className="admin-queue-health-eyebrow">Admin Queue Health</p>
          <p className="admin-queue-health-title">Daily runway snapshot</p>
        </div>
        {health.isLow ? <span className="admin-queue-health-warning">Low queue</span> : <span className="admin-queue-health-ok">Healthy</span>}
      </div>

      <div className="admin-queue-health-grid">
        <div className="admin-queue-health-metric">
          <span>Approved total</span>
          <strong>{health.approved}</strong>
        </div>
        <div className="admin-queue-health-metric">
          <span>Used / scheduled</span>
          <strong>{health.scheduled}</strong>
        </div>
        <div className="admin-queue-health-metric">
          <span>Future runway</span>
          <strong>{health.runwayDays}</strong>
        </div>
      </div>

      {health.isLow ? (
        <p className="admin-queue-health-copy">
          Low queue warning: future runway is below {health.lowQueueThreshold} day{health.lowQueueThreshold === 1 ? "" : "s"}. Add or approve more candidates.
        </p>
      ) : (
        <p className="admin-queue-health-copy">Queue has enough future approved runway for the current threshold.</p>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function EmailAdminPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientSummary, setRecipientSummary] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [sending, setSending] = useState(false);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    setError("");
    try {
      const response = await fetch("/api/admin/email/marketing", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load recipients");
      }
      setRecipientSummary(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    void loadRecipients();
  }, []);

  const submit = async (action) => {
    const preview = action === "preview";
    const dryRun = action === "dryRun";
    setSending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/email/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, dryRun, preview }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send marketing email");
      }

      if (preview) {
        setPreviewHtml(payload.html || "");
        setPreviewSubject(payload.subject || subject);
        setMessage("Preview updated.");
      } else if (dryRun) {
        setMessage(`Dry run ready: ${payload.recipients} recipient${payload.recipients === 1 ? "" : "s"} would receive this email.`);
      } else {
        setMessage(`Sent ${payload.sent} marketing email${payload.sent === 1 ? "" : "s"}.`);
        await loadRecipients();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send marketing email");
    } finally {
      setSending(false);
    }
  };

  const recipientCount = recipientSummary?.recipients ?? 0;

  return (
    <section className="admin-card">
      <h1 className="admin-title">Email</h1>
      <p className="admin-copy">Send product updates and launch news to users who opted into marketing emails.</p>

      <div style={{ marginTop: ".95rem", border: "1px solid #d8dce2", borderRadius: 18, background: "#f8fafc", padding: ".9rem" }}>
        <p style={{ margin: 0, color: "#595c5e", fontSize: ".74rem", fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Marketing audience
        </p>
        {loadingRecipients ? (
          <p className="admin-copy">Loading recipients...</p>
        ) : (
          <>
            <p style={{ margin: ".15rem 0 0", fontSize: "1.7rem", fontWeight: 950 }}>{recipientCount}</p>
            <p className="admin-copy">
              {recipientSummary?.optedInProfiles ?? 0} opted-in profile{recipientSummary?.optedInProfiles === 1 ? "" : "s"} found.
            </p>
            {recipientSummary?.sampleEmails?.length ? (
              <p className="admin-copy">Sample: {recipientSummary.sampleEmails.join(", ")}</p>
            ) : null}
          </>
        )}
      </div>

      <div style={{ marginTop: ".95rem", display: "grid", gap: ".7rem" }}>
        <label style={{ display: "grid", gap: ".35rem", fontWeight: 900 }}>
          Subject
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="DailyDabble update"
            maxLength={120}
            style={{ width: "100%", padding: ".72rem .85rem", borderRadius: 12, border: "1px solid #d8dce2", font: "inherit" }}
          />
        </label>
        <label style={{ display: "grid", gap: ".35rem", fontWeight: 900 }}>
          Body
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={"Write the email body here. Blank lines become separate paragraphs."}
            rows={10}
            maxLength={5000}
            style={{ width: "100%", padding: ".72rem .85rem", borderRadius: 12, border: "1px solid #d8dce2", font: "inherit", resize: "vertical" }}
          />
        </label>
      </div>

      {error ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#8b2d2d", fontWeight: 800 }}>{error}</p> : null}
      {message ? <p className="admin-copy" style={{ marginTop: ".75rem", color: "#2f672d", fontWeight: 800 }}>{message}</p> : null}

      <div className="admin-actions">
        <button
          type="button"
          className="admin-btn"
          onClick={() => void submit("preview")}
          disabled={sending || loadingRecipients}
        >
          {sending ? "Working..." : "Preview"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void submit("dryRun")}
          disabled={sending || loadingRecipients}
        >
          {sending ? "Working..." : "Dry Run"}
        </button>
        <button
          type="button"
          className="admin-btn primary"
          onClick={() => {
            if (!window.confirm(`Send this marketing email to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}?`)) {
              return;
            }
            void submit("send");
          }}
          disabled={sending || loadingRecipients || recipientCount === 0}
        >
          {sending ? "Sending..." : "Send Marketing Email"}
        </button>
      </div>

      {previewHtml ? (
        <div style={{ marginTop: "1rem", border: "1px solid #d8dce2", borderRadius: 18, background: "#f8fafc", padding: ".9rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#595c5e", fontSize: ".74rem", fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
                Preview
              </p>
              <p className="admin-copy" style={{ marginTop: ".2rem" }}>Subject: {previewSubject}</p>
            </div>
            <button type="button" className="admin-btn" onClick={() => setPreviewHtml("")}>
              Hide Preview
            </button>
          </div>
          <iframe
            title="Marketing email preview"
            srcDoc={previewHtml}
            style={{ marginTop: ".75rem", width: "100%", minHeight: 680, border: "1px solid #d8dce2", borderRadius: 14, background: "white" }}
          />
        </div>
      ) : null}
    </section>
  );
}

import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
import { d as useDialog, B as Button, T as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const AUDIENCES = [
  { value: "test", label: "Just me (test)", hint: "Send only to your own address to check it." },
  { value: "users", label: "All users", hint: "Every registered account." },
  { value: "leads", label: "Bot Check leads", hint: "People who scanned a site and left an email (not yet customers)." },
  { value: "custom", label: "Specific addresses", hint: "Paste addresses below, separated by commas or new lines." }
];
const STARTER = `<p>Hi there,</p>
<p>Write your message here. You can use simple HTML — <b>bold</b>, <a href="https://trynobot.com">links</a>, and paragraphs.</p>
<p>— The TryNoBot team</p>`;
function AdminEmail() {
  const { confirm, notify } = useDialog();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER);
  const [mode, setMode] = useState("test");
  const [emails, setEmails] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  async function refreshPreview() {
    try {
      const r = await adminApi.emailPreview(subject, body);
      setPreview(r.html);
    } catch {
      setPreview("<p style='padding:1rem;color:#b91c1c'>Preview failed.</p>");
    }
  }
  async function send() {
    var _a;
    if (!subject.trim() || !body.trim()) {
      notify("Subject and body are required.");
      return;
    }
    const aud = AUDIENCES.find((a) => a.value === mode);
    if (!await confirm({
      title: `Send to: ${aud.label}?`,
      message: mode === "test" ? "This sends only to your own address." : `This emails ${aud.label.toLowerCase()}. This cannot be undone — send a test to yourself first if you haven't.`,
      confirmLabel: "Send now",
      cancelLabel: "Cancel",
      tone: mode === "test" ? "brand" : "danger"
    })) return;
    setBusy(true);
    try {
      const r = await adminApi.sendEmail({ subject, body_html: body, mode, emails });
      notify(`Sent to ${r.sent} of ${r.recipients} recipient(s).`);
    } catch (e) {
      notify(((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.detail) || "Send failed.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Send an email" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Compose, preview exactly how it will look in an inbox, then send." }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-semibold", children: "Subject" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: subject,
              onChange: (e) => setSubject(e.target.value),
              placeholder: "Your subject line",
              className: "mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-semibold", children: "Body (HTML)" }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              value: body,
              onChange: (e) => setBody(e.target.value),
              rows: 12,
              className: "mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-dim", children: "Simple HTML only: paragraphs, bold/italic, links. The header, footer and styling are added automatically." })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "text-sm font-semibold", children: "Audience" }),
          /* @__PURE__ */ jsx("div", { className: "mt-1 space-y-1.5", children: AUDIENCES.map((a) => /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 ${mode === a.value ? "border-brand bg-brand/5" : "border-line"}`, children: [
            /* @__PURE__ */ jsx("input", { type: "radio", name: "aud", className: "mt-1 accent-brand", checked: mode === a.value, onChange: () => setMode(a.value) }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold", children: a.label }),
              /* @__PURE__ */ jsx("br", {}),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-muted", children: a.hint })
            ] })
          ] }, a.value)) }),
          mode === "custom" && /* @__PURE__ */ jsx(
            "textarea",
            {
              value: emails,
              onChange: (e) => setEmails(e.target.value),
              rows: 3,
              placeholder: "a@example.com, b@example.com",
              className: "mt-2 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(Button, { onClick: refreshPreview, variant: "outline", children: "Update preview" }),
          /* @__PURE__ */ jsx(Button, { onClick: send, disabled: busy, children: busy ? "Sending…" : "Send" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold", children: "Inbox preview" }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "Exactly what recipients see" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-xl border border-line bg-bg-mute", children: preview ? /* @__PURE__ */ jsx("iframe", { title: "Email preview", srcDoc: preview, className: "h-[560px] w-full border-0 bg-white" }) : /* @__PURE__ */ jsx("div", { className: "grid h-[560px] place-items-center text-sm text-fg-dim", children: "Click “Update preview” to render your email." }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900", children: [
      /* @__PURE__ */ jsx("b", { children: "Deliverability:" }),
      " whether these reach the inbox or spam is decided mostly by DNS. Make sure your sending domain has ",
      /* @__PURE__ */ jsx("b", { children: "SPF, DKIM and DMARC" }),
      " configured in Resend + Cloudflare. Always “Just me (test)” first, and avoid spammy words in the subject."
    ] })
  ] });
}
export {
  AdminEmail as default
};

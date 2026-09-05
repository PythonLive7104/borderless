import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { A as useDialog, c as useWorkspace, u as useAuth, B as Button, o as orgApi } from "../entry-server.js";
import { M as Modal } from "./Modal-CEHlixCW.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const roleTone = {
  owner: "bg-brand/10 text-brand",
  admin: "bg-violet/10 text-violet",
  analyst: "bg-bg-mute text-fg-muted"
};
function Team() {
  const { confirm } = useDialog();
  const { current, reload } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [err, setErr] = useState("");
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const m = await orgApi.members(current.id);
      setMembers(m.results);
      if (canManage) {
        const inv = await orgApi.invitations(current.id);
        setInvites(Array.isArray(inv) ? inv : inv.results);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  async function invite(e) {
    var _a, _b, _c;
    e.preventDefault();
    setErr("");
    try {
      await orgApi.invite(current.id, email, role);
      setOpen(false);
      setEmail("");
      load();
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || ((_c = (_b = e2.data) == null ? void 0 : _b.email) == null ? void 0 : _c[0]) || e2.message);
    }
  }
  async function changeRole(m, r) {
    await orgApi.changeRole(current.id, m.id, r);
    load();
    reload();
  }
  async function removeMember(m) {
    if (!await confirm({
      title: "Remove this member?",
      message: `${m.email} will lose access to this workspace immediately.`,
      confirmLabel: "Remove member"
    })) return;
    await orgApi.removeMember(current.id, m.id);
    load();
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "team", children: [
      "Invite the people you work with into this workspace. ",
      /* @__PURE__ */ jsx("b", { children: "Owners" }),
      " and ",
      /* @__PURE__ */ jsx("b", { children: "Admins" }),
      " can change everything; ",
      /* @__PURE__ */ jsx("b", { children: "Analysts" }),
      " can view reports but not make changes. Invited people get an email link to join."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Team" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "People in ",
          current == null ? void 0 : current.name,
          "."
        ] })
      ] }),
      canManage && /* @__PURE__ */ jsx(Button, { onClick: () => setOpen(true), children: "+ Invite member" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Member" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Role" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: members.map((m) => {
          const isSelf = m.email === (user == null ? void 0 : user.email);
          return /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
            /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "font-semibold", children: [
                [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email,
                isSelf && /* @__PURE__ */ jsx("span", { className: "ml-2 text-xs text-fg-dim", children: "(you)" })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "text-xs text-fg-muted", children: m.email })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: canManage && m.role !== "owner" && !isSelf ? /* @__PURE__ */ jsxs(
              "select",
              {
                value: m.role,
                onChange: (e) => changeRole(m, e.target.value),
                className: "rounded-lg border border-line bg-white px-2 py-1 text-sm",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "admin", children: "Admin" }),
                  /* @__PURE__ */ jsx("option", { value: "analyst", children: "Analyst" })
                ]
              }
            ) : /* @__PURE__ */ jsx("span", { className: `rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${roleTone[m.role]}`, children: m.role }) }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-right", children: canManage && m.role !== "owner" && !isSelf && /* @__PURE__ */ jsx("button", { onClick: () => removeMember(m), className: "text-sm text-red-500 hover:underline", children: "Remove" }) })
          ] }, m.id);
        }) })
      ] }) }),
      canManage && invites.length > 0 && /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-5 p-5", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Pending invitations" }),
        /* @__PURE__ */ jsx("div", { className: "mt-3 space-y-2", children: invites.map((i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-sm", children: [
          /* @__PURE__ */ jsx("span", { children: i.email }),
          /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${roleTone[i.role]}`, children: i.role }),
            /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "invited" })
          ] })
        ] }, i.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: "Invite member", children: /* @__PURE__ */ jsxs("form", { onSubmit: invite, className: "space-y-4", children: [
      /* @__PURE__ */ jsx(Field, { label: "Email", type: "email", value: email, onChange: setEmail, placeholder: "teammate@company.com" }),
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Role" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: role,
            onChange: (e) => setRole(e.target.value),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand",
            children: [
              /* @__PURE__ */ jsx("option", { value: "analyst", children: "Analyst — view only" }),
              /* @__PURE__ */ jsx("option", { value: "admin", children: "Admin — full access except billing/ownership" })
            ]
          }
        )
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: "Send invitation" })
    ] }) })
  ] });
}
export {
  Team as default
};

import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAuth } from "../../context/AuthContext";
import { orgApi, type Member, type Invitation, type Role } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import PageNote from "../../components/dashboard/PageNote";

const roleTone: Record<string, string> = {
  owner: "bg-brand/10 text-brand", admin: "bg-violet/10 text-violet", analyst: "bg-bg-mute text-fg-muted",
};

export default function Team() {
  const { current, reload } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  const [err, setErr] = useState("");
  const canManage = current?.role === "owner" || current?.role === "admin";

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
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await orgApi.invite(current!.id, email, role); setOpen(false); setEmail(""); load(); }
    catch (e: any) { setErr(e.data?.detail || e.data?.email?.[0] || e.message); }
  }
  async function changeRole(m: Member, r: Role) { await orgApi.changeRole(current!.id, m.id, r); load(); reload(); }
  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.email} from the workspace?`)) return;
    await orgApi.removeMember(current!.id, m.id); load();
  }

  return (
    <div>
      <PageNote id="team">
        Invite the people you work with into this workspace. <b>Owners</b> and <b>Admins</b> can change everything; <b>Analysts</b> can view reports but not make changes. Invited people get an email link to join.
      </PageNote>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-fg-muted">People in {current?.name}.</p></div>
        {canManage && <Button onClick={() => setOpen(true)}>+ Invite member</Button>}
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div> : (
        <>
          <div className="card shadow-soft mt-6 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => {
                  const isSelf = m.email === user?.email;
                  return (
                    <tr key={m.id} className="hover:bg-bg-soft">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}{isSelf && <span className="ml-2 text-xs text-fg-dim">(you)</span>}</div>
                        <div className="text-xs text-fg-muted">{m.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {canManage && m.role !== "owner" && !isSelf ? (
                          <select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}
                            className="rounded-lg border border-line bg-white px-2 py-1 text-sm">
                            <option value="admin">Admin</option><option value="analyst">Analyst</option>
                          </select>
                        ) : <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${roleTone[m.role]}`}>{m.role}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && m.role !== "owner" && !isSelf && <button onClick={() => removeMember(m)} className="text-sm text-red-500 hover:underline">Remove</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canManage && invites.length > 0 && (
            <div className="card shadow-soft mt-5 p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Pending invitations</h3>
              <div className="mt-3 space-y-2">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm">
                    <span>{i.email}</span>
                    <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${roleTone[i.role]}`}>{i.role}</span><span className="text-xs text-fg-dim">invited</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Invite member">
        <form onSubmit={invite} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="teammate@company.com" />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand">
              <option value="analyst">Analyst — view only</option>
              <option value="admin">Admin — full access except billing/ownership</option>
            </select>
          </label>
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full">Send invitation</Button>
        </form>
      </Modal>
    </div>
  );
}

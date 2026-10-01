"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldOff, UserPlus } from "lucide-react";

import { inviteVendor, setVendorStatus, type TeamActionState } from "@/app/(tenant)/workspace/team/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import type { TenantUser } from "@/types/domain";

import styles from "./workspace.module.css";

const initialState: TeamActionState = { status: null, message: "" };

function Feedback({ state }: { state: TeamActionState }) {
  return state.message ? <p className={state.status === "error" ? styles.error : styles.success} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null;
}

function AccessForm({ user }: { user: TenantUser }) {
  const [state, action, pending] = useActionState(setVendorStatus, initialState);
  const next = user.status === "active" ? "inactive" : "active";
  return <form action={action} className={styles.accessForm} onSubmit={(event) => {
    if (next === "inactive" && !window.confirm(`Revoke access for ${user.displayName}?`)) event.preventDefault();
  }}>
    <input type="hidden" name="user_id" value={user.id} /><input type="hidden" name="status" value={next} />
    <Button type="submit" size="sm" variant={next === "inactive" ? "danger" : "secondary"} disabled={pending} icon={next === "inactive" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}>{pending ? "Updating…" : next === "inactive" ? "Revoke" : "Restore"}</Button>
    <Feedback state={state} />
  </form>;
}

export function TeamManagement({ users }: { users: TenantUser[] }) {
  const [state, action, pending] = useActionState(inviteVendor, initialState);
  return <div className={styles.stack}>
    <Card>
      <CardHeader title="Invite a vendor" description="The invitation opens the mobile password-setup flow and always joins this tenant." />
      <form action={action} className={styles.inviteForm}>
        <label>Name<input name="display_name" required maxLength={120} placeholder="Team member" /></label>
        <label>Email<input name="email" type="email" required maxLength={254} placeholder="member@example.com" /></label>
        <Button type="submit" disabled={pending} icon={<UserPlus size={17} />}>{pending ? "Inviting…" : "Invite vendor"}</Button>
        <Feedback state={state} />
      </form>
    </Card>
    <Card>
      <CardHeader title="Vendor accounts" description="Revoking one account leaves every other tenant user active." />
      {users.length ? <div className="table-wrap"><table><thead><tr><th>User</th><th>Joined</th><th>Access</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong><small className={styles.email}>{user.email}</small></td><td>{formatDate(user.createdAt)}</td><td><Badge tone={user.status === "active" ? "success" : "danger"}>{user.status === "active" ? "Allowed" : "Revoked"}</Badge></td><td><AccessForm user={user} /></td></tr>)}</tbody></table></div> : <p className={styles.empty}>No vendor accounts have been invited yet.</p>}
    </Card>
  </div>;
}

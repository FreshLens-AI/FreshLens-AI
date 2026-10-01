"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldOff, UserPlus, Users } from "lucide-react";

import {
  inviteTenantUser,
  setTenantStatus,
  setTenantUserStatus,
  type AccessMutationState,
} from "@/app/(admin)/tenants/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import type { TenantStatus, TenantUser } from "@/types/domain";

import styles from "./tenants.module.css";

const initialState: AccessMutationState = { status: null, message: "" };

function Feedback({ state }: { state: AccessMutationState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={state.status === "error" ? styles.createError : styles.createSuccess}
    >
      {state.message}
    </p>
  );
}

function TenantAccessForm({
  tenantId,
  tenantName,
  status,
}: {
  tenantId: string;
  tenantName: string;
  status: TenantStatus;
}) {
  const [state, action, pending] = useActionState(setTenantStatus, initialState);
  const nextStatus = status === "active" ? "inactive" : "active";
  return (
    <form
      action={action}
      className={styles.accessAction}
      onSubmit={(event) => {
        if (nextStatus === "inactive" &&
            !window.confirm(`Revoke access for every user in ${tenantName}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button
        type="submit"
        variant={nextStatus === "inactive" ? "danger" : "secondary"}
        disabled={pending}
        icon={nextStatus === "inactive" ? <ShieldOff size={17} /> : <ShieldCheck size={17} />}
      >
        {pending
          ? "Updating…"
          : nextStatus === "inactive"
            ? "Revoke tenant access"
            : "Restore tenant access"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function InviteUserForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(inviteTenantUser, initialState);
  return (
    <form action={action} className={styles.memberInviteForm}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <label>
        Name
        <input name="display_name" required maxLength={120} placeholder="Team member" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={254} placeholder="member@example.com" />
      </label>
      <Button type="submit" disabled={pending} icon={<UserPlus size={17} />}>
        {pending ? "Inviting…" : "Invite user"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function UserAccessForm({ user }: { user: TenantUser }) {
  const [state, action, pending] = useActionState(setTenantUserStatus, initialState);
  const nextStatus = user.status === "active" ? "inactive" : "active";
  return (
    <form
      action={action}
      className={styles.userAccessForm}
      onSubmit={(event) => {
        if (nextStatus === "inactive" &&
            !window.confirm(`Revoke access for ${user.displayName}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="tenant_id" value={user.tenantId} />
      <input type="hidden" name="user_id" value={user.id} />
      <input type="hidden" name="status" value={nextStatus} />
      <Button
        type="submit"
        size="sm"
        variant={nextStatus === "inactive" ? "danger" : "secondary"}
        disabled={pending}
      >
        {pending ? "Updating…" : nextStatus === "inactive" ? "Revoke" : "Restore"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function TenantAccessManagement({
  tenantId,
  tenantName,
  tenantStatus,
  users,
}: {
  tenantId: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  users: TenantUser[];
}) {
  return (
    <div className={styles.accessStack}>
      <Card className={styles.accessCard}>
        <CardHeader
          title="Tenant access"
          description="Revoking tenant access blocks every vendor account in this organization. Data remains intact."
          action={
            <Badge tone={tenantStatus === "active" ? "success" : "danger"}>
              {tenantStatus === "active" ? "Allowed" : "Revoked"}
            </Badge>
          }
        />
        <TenantAccessForm
          tenantId={tenantId}
          tenantName={tenantName}
          status={tenantStatus}
        />
      </Card>

      <Card className={styles.membersCard}>
        <CardHeader
          title="Tenant users"
          description="Invite vendor users and control access for individual accounts."
          action={<span className={styles.memberCount}><Users size={17} />{users.length}</span>}
        />
        <InviteUserForm tenantId={tenantId} />
        {users.length ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.memberTable}`}>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Access</th>
                  <th scope="col"><span className={styles.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.displayName}</strong>
                      <small className={styles.memberEmail}>{user.email}</small>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <Badge tone={user.status === "active" ? "success" : "danger"}>
                        {user.status === "active" ? "Allowed" : "Revoked"}
                      </Badge>
                    </td>
                    <td><UserAccessForm user={user} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.noMembers}>No vendor users have been added to this tenant yet.</p>
        )}
      </Card>
    </div>
  );
}

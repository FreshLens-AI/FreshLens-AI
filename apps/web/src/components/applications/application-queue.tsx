"use client";

import { useActionState } from "react";
import { Check, Mail, Phone, Store, X } from "lucide-react";

import {
  approveApplication,
  rejectApplication,
  type ReviewState,
} from "@/app/(admin)/applications/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/formatters";
import type { TenantApplication } from "@/lib/api/applications";

import styles from "./applications.module.css";

const initialState: ReviewState = { status: null, message: "" };

function DecisionForm({ applicationId, decision }: {
  applicationId: string;
  decision: "approve" | "reject";
}) {
  const action = decision === "approve" ? approveApplication : rejectApplication;
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className={styles.decisionForm}>
      <input type="hidden" name="application_id" value={applicationId} />
      <Button
        type="submit"
        variant={decision === "approve" ? "primary" : "danger"}
        disabled={pending}
        icon={decision === "approve" ? <Check size={16} /> : <X size={16} />}
      >
        {pending ? "Working…" : decision === "approve" ? "Approve & invite" : "Reject"}
      </Button>
      {state.message ? (
        <span className={state.status === "error" ? styles.error : styles.success} role={state.status === "error" ? "alert" : "status"}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function ApplicationQueue({ applications }: { applications: TenantApplication[] }) {
  if (!applications.length) {
    return <EmptyState icon={<Store size={22} />} title="No pending applications" description="New tenant signup requests will appear here for review." />;
  }
  return (
    <div className={styles.grid}>
      {applications.map((application) => (
        <article className={`card ${styles.application}`} key={application.id}>
          <div>
            <p className={styles.date}>Submitted {formatDateTime(application.submitted_at)}</p>
            <h2>{application.organization_name}</h2>
            <p className={styles.owner}>{application.applicant_name}</p>
          </div>
          <div className={styles.contact}>
            <span><Mail size={15} />{application.applicant_email}</span>
            {application.phone ? <span><Phone size={15} />{application.phone}</span> : null}
          </div>
          <div className={styles.actions}>
            <DecisionForm applicationId={application.id} decision="approve" />
            <DecisionForm applicationId={application.id} decision="reject" />
          </div>
        </article>
      ))}
    </div>
  );
}

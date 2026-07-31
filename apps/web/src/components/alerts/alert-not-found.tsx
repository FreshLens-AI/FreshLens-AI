import { FileQuestion, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

import styles from "./alerts.module.css";

export function AlertNotFound({ id }: { id: string }) {
  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Alert administration"
        title="Alert not found"
        description="The requested alert ID does not exist in this demo workspace."
        breadcrumbs={[
          { label: "Alerts", href: "/alerts" },
          { label: "Not found" },
        ]}
      />
      <EmptyState
        icon={<FileQuestion size={25} aria-hidden="true" />}
        title="We could not find that alert"
        description={`No alert matches “${id}”. It may be an incomplete link or a record that was never created in this browser.`}
        action={
          <div className={styles.emptyActions}>
            <Button
              href="/alerts"
              icon={<ListFilter size={17} aria-hidden="true" />}
            >
              Browse alerts
            </Button>
            <Button href="/alerts/new" variant="secondary">
              Create alert
            </Button>
          </div>
        }
      />
    </div>
  );
}

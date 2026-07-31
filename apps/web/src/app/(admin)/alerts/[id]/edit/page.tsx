"use client";

import { useParams } from "next/navigation";

import { AlertForm } from "@/components/alerts/alert-form";
import { AlertNotFound } from "@/components/alerts/alert-not-found";
import { useAdminData } from "@/store/admin-data-provider";

export default function EditAlertPage() {
  const { id } = useParams<{ id: string }>();
  const { alerts } = useAdminData();
  const alert = alerts.find((item) => item.id === id);

  if (!alert) return <AlertNotFound id={id} />;
  return <AlertForm mode="edit" alert={alert} />;
}

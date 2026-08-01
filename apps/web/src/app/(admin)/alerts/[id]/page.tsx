"use client";

import { useParams } from "next/navigation";

import { AlertDetail } from "@/components/alerts/alert-detail";

export default function AlertDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AlertDetail id={id} />;
}

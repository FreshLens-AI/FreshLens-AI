"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <div className="standalone-state" role="alert">
      <div className="standalone-state__mark"><TriangleAlert size={25} /></div>
      <p className="eyebrow">Something went wrong</p>
      <h1>We couldn’t load this admin view.</h1>
      <p>Your demo data is still safe in this browser. Try loading the page again.</p>
      <Button onClick={unstable_retry}>Try again</Button>
    </div>
  );
}

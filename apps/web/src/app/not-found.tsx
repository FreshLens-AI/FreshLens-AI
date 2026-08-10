import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <div className="standalone-state__mark"><Compass size={26} /></div>
      <p className="eyebrow">404 · Page not found</p>
      <h1>This route is not in the admin workspace.</h1>
      <p>The page may have moved, or the link may be incomplete.</p>
      <Button href="/dashboard">Return to overview</Button>
    </main>
  );
}

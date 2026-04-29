import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-black/5 p-4 text-black/40">
        <Search className="h-10 w-10" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="mb-8 max-w-md text-black/60">
        We couldn't find the page you're looking for. It might have been moved or deleted.
      </p>
      <Link href="/">
        <Button className="rounded-full">
          Return Home
        </Button>
      </Link>
    </div>
  );
}

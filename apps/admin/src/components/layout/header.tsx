import { Link } from "react-router";

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center gap-4 px-4">
        <Link to="/" className="font-bold text-lg">
          FB Store
        </Link>
        <span className="text-muted-foreground text-sm">Admin</span>
      </div>
    </header>
  );
}

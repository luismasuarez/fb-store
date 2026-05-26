import { NavLink } from "react-router";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/listings", label: "Listings" },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r min-h-[calc(100vh-4rem)] p-4">
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/usage", label: "Usage" },
  { href: "/management", label: "Management" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function isActiveLink(href: string): boolean {
    return pathname === href;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const data = await res.json();

      if (data.azureLogoutUrl) {
        window.location.href = data.azureLogoutUrl;
      } else {
        router.push("/login");
      }
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <nav aria-label="Main navigation" className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-12 items-center gap-6">
          <span className="text-sm font-semibold text-gray-900">
            Copilot Dashboard
          </span>
          <ul className="flex gap-4">
            {navLinks.map(({ href, label }) => {
              const isActive = isActiveLink(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`text-sm px-1 py-1 ${
                      isActive
                        ? "font-semibold text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="ml-auto">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EmployeeRow = {
  id: number;
  name: string;
  role: string;
  phone: string;
  email: string;
  photoUrl: string | null;
  created: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

export default function EmployeesClient({
  employees,
}: {
  employees: EmployeeRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.name, e.role, e.phone, e.email].join(" ").toLowerCase().includes(q)
    );
  }, [employees, query]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-page-title text-white">Employees</h1>
          <Link
            href="/employees/new"
            aria-label="Add employee"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary hover:opacity-90 text-primary-foreground md:hidden"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {employees.length > 0 && (
            <div className="relative flex-1 md:flex-none md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team members"
                className="w-full rounded-full pl-9 text-sm"
              />
            </div>
          )}
          <Button asChild className="hidden md:inline-flex">
            <Link href="/employees/new">
              <Plus className="mr-1 h-4 w-4" strokeWidth={2.5} />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      {employees.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-400 font-bold">
          No employees yet. Click &ldquo;Add Employee&rdquo; to add your first
          team member.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-zinc-400 font-bold">
          No team members match &ldquo;{query}&rdquo;.
        </Card>
      ) : (
        <>
          {/* Mobile: contact-list rows. Tap a row to open the employee. */}
          <Card className="overflow-hidden divide-y divide-line md:hidden">
            {filtered.map((e) => (
              <Link
                key={e.id}
                href={`/employees/${e.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 active:bg-black/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-black text-[13px] font-bold text-zinc-300">
                  {e.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.photoUrl}
                      alt={e.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(e.name)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-white">
                    {e.name}
                  </span>
                  <span className="block truncate text-[13px] font-semibold text-zinc-400">
                    {e.role}
                  </span>
                  {e.phone !== "—" && (
                    <span className="block truncate text-[13px] font-semibold text-zinc-400">
                      {e.phone}
                    </span>
                  )}
                  {e.email && (
                    <span className="block truncate text-[13px] font-semibold text-zinc-500">
                      {e.email}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </Card>

          {/* Desktop: full table. */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-line text-left hover:bg-transparent">
                  <TableHead className="h-auto px-4 py-3 w-14"></TableHead>
                  <TableHead className="h-auto px-4 py-3 text-xs font-bold text-zinc-500">
                    Name
                  </TableHead>
                  <TableHead className="h-auto px-4 py-3 text-xs font-bold text-zinc-500">
                    Role
                  </TableHead>
                  <TableHead className="h-auto px-4 py-3 text-xs font-bold text-zinc-500">
                    Phone
                  </TableHead>
                  <TableHead className="h-auto px-4 py-3 text-xs font-bold text-zinc-500">
                    Email
                  </TableHead>
                  <TableHead className="h-auto px-4 py-3 text-xs font-bold text-zinc-500">
                    Created
                  </TableHead>
                  <TableHead className="h-auto px-4 py-3 w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow
                    key={e.id}
                    className="border-b border-line last:border-0 hover:bg-black"
                  >
                    <TableCell className="px-4 py-4">
                      <div className="w-10 h-10 rounded-full bg-black border border-line flex items-center justify-center overflow-hidden">
                        {e.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.photoUrl}
                            alt={e.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User
                            className="w-5 h-5 text-zinc-500"
                            strokeWidth={1.5}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm font-extrabold text-white tracking-tight">
                      {e.name}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-zinc-400 font-bold">
                      {e.role}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-zinc-400 font-bold">
                      {e.phone}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-zinc-400 font-bold">
                      {e.email || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-zinc-400 font-bold">
                      {e.created}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <Link
                        href={`/employees/${e.id}/edit`}
                        className="text-sm text-white hover:underline"
                      >
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

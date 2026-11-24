import { PackageCheck } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { listServiceOrders, type ServiceOrderRow } from "@/lib/admin/service-orders";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { AdminEmpty } from "../_ui/states";
import { AdminStatus } from "../_ui/status";
import { DeliverOrder } from "./deliver-order";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service orders" };

const day = (date: Date) => formatDate(date, "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Admin -> Service orders (lib/admin/service-orders.ts): what customers bought that the team delivers by hand. */
export default async function ServiceOrdersPage() {
  const rows = await listServiceOrders();
  const waiting = rows.filter((row) => row.status === "paid");
  const delivered = rows.filter((row) => row.status !== "paid");

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Service orders"
        description="Services customers bought with credits that the team delivers by hand. Marking one delivered shows it as delivered on the customer's Billing page; no money or credits move."
      />
      <AdminSection id="waiting" title={`To deliver (${waiting.length})`} description="Oldest first." bodyClassName="p-0">
        {waiting.length === 0 ? (
          <AdminEmpty filtering={false} icon={PackageCheck} noun="orders" title="Nothing to deliver." description="A service bought in Billing appears here." />
        ) : (
          <ul className="divide-y">
            {waiting.map((row) => (
              <Order key={row.id} row={row} />
            ))}
          </ul>
        )}
      </AdminSection>
      {delivered.length > 0 ? (
        <AdminSection id="delivered" title="Delivered" description="The latest." bodyClassName="p-0">
          <ul className="divide-y">
            {delivered.map((row) => (
              <Order key={row.id} row={row} />
            ))}
          </ul>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}

function Order({ row }: { row: ServiceOrderRow }) {
  const paid =
    row.creditsPaid !== null
      ? `${formatNumber(row.creditsPaid, "en")} credits`
      : new Intl.NumberFormat("en-IE", { style: "currency", currency: row.currency.toUpperCase() }).format(row.pricePaidCents / 100);
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium wrap-anywhere">{row.service}</p>
        <p className="mt-0.5 text-sm text-muted-foreground wrap-anywhere">
          <Link
            href={`/admin/organizations?q=${encodeURIComponent(row.organizationName)}`}
            className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {row.organizationName}
          </Link>{" "}
          · {paid} · ordered {day(row.createdAt)}
        </p>
      </div>
      {row.status === "paid" ? (
        <DeliverOrder id={row.id} service={row.service} workspace={row.organizationName} />
      ) : (
        <AdminStatus tone="success" label={row.fulfilledAt ? `Delivered ${day(row.fulfilledAt)}` : "Delivered"} />
      )}
    </li>
  );
}

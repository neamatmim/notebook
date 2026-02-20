import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/utils/orpc";

interface CustomerAccountDialogProps {
  customerId: string | null;
  onClose: () => void;
}

type Tab = "overview" | "payments" | "purchases";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  gift_card: "Gift Card",
  mobile_payment: "Mobile Payment",
  on_account: "On Account",
  store_credit: "Store Credit",
};

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-100 text-green-700",
  check: "bg-gray-100 text-gray-700",
  credit_card: "bg-blue-100 text-blue-700",
  debit_card: "bg-indigo-100 text-indigo-700",
  gift_card: "bg-pink-100 text-pink-700",
  mobile_payment: "bg-purple-100 text-purple-700",
  on_account: "bg-orange-100 text-orange-700",
  store_credit: "bg-yellow-100 text-yellow-700",
};

function fmt(v: number | string | null | undefined): string {
  return `$${Number(v ?? 0).toFixed(2)}`;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) {
    return "—";
  }
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CustomerTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    employee: "bg-purple-100 text-purple-800",
    regular: "bg-gray-100 text-gray-800",
    vip: "bg-yellow-100 text-yellow-800",
    wholesale: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${colors[type] ?? colors.regular}`}
    >
      {type}
    </span>
  );
}

export function CustomerAccountDialog({
  customerId,
  onClose,
}: CustomerAccountDialogProps) {
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading } = useQuery(
    orpc.pos.customers.account.queryOptions({
      enabled: Boolean(customerId),
      input: { id: customerId! },
    })
  );

  const c = data?.customer;
  const s = data?.summary;

  const fullName =
    [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "Customer";
  const fullAddress = [c?.address, c?.city, c?.state, c?.zipCode, c?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog
      open={Boolean(customerId)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-green-600" />
            Customer Account
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : !c ? (
          <p className="text-muted-foreground px-6 py-8 text-center">
            Customer not found.
          </p>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Profile header */}
            <div className="bg-muted/30 flex items-start justify-between gap-4 border-b px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{fullName}</h2>
                  <CustomerTypeBadge type={c.type ?? "regular"} />
                </div>
                <p className="text-muted-foreground text-sm">
                  {c.customerNumber}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {c.email && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {c.phone}
                    </span>
                  )}
                  {fullAddress && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {fullAddress}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Member since</p>
                <p className="font-medium">{fmtDate(c.createdAt)}</p>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 border-b px-6 py-4 sm:grid-cols-4">
              <div className="rounded-lg bg-green-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Total Spent
                </div>
                <p className="mt-1 text-lg font-bold text-green-700">
                  {fmt(s?.totalSpent)}
                </p>
              </div>
              <div
                className={`rounded-lg p-3 ${(s?.dueBalance ?? 0) > 0 ? "bg-red-50" : "bg-gray-50"}`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${(s?.dueBalance ?? 0) > 0 ? "text-red-700" : "text-gray-600"}`}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Due Balance
                </div>
                <p
                  className={`mt-1 text-lg font-bold ${(s?.dueBalance ?? 0) > 0 ? "text-red-700" : "text-gray-700"}`}
                >
                  {fmt(s?.dueBalance)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                  <CreditCard className="h-3.5 w-3.5" />
                  Store Credit
                </div>
                <p className="mt-1 text-lg font-bold text-blue-700">
                  {fmt(s?.creditBalance)}
                </p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700">
                  <Star className="h-3.5 w-3.5" />
                  Loyalty Points
                </div>
                <p className="mt-1 text-lg font-bold text-yellow-700">
                  {s?.loyaltyPoints ?? 0}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b px-6 pt-2">
              {(
                [
                  ["overview", "Overview"],
                  ["purchases", `Purchases (${data?.recentSales.length ?? 0})`],
                  [
                    "payments",
                    `Payments (${(data?.allPayments.length ?? 0) + (data?.dueCollectionHistory.filter((d) => d.status !== "voided").length ?? 0)})`,
                  ],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
                    tab === key
                      ? "border-green-600 text-green-700"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Overview tab */}
              {tab === "overview" && (
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Total Orders
                      </p>
                      <p className="text-base font-semibold">
                        {s?.totalOrders ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Avg Order Value
                      </p>
                      <p className="text-base font-semibold">
                        {fmt(s?.averageOrderValue)}
                      </p>
                    </div>
                    {c.discountRate && (
                      <div>
                        <p className="text-muted-foreground text-xs">
                          Discount Rate
                        </p>
                        <p className="text-base font-semibold">
                          {(Number(c.discountRate) * 100).toFixed(1)}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment method breakdown */}
                  {Object.keys(data?.paymentMethodTotals ?? {}).length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">
                        Payments by Method
                      </p>
                      <div className="space-y-1.5">
                        {(
                          Object.entries(data!.paymentMethodTotals) as [
                            string,
                            number,
                          ][]
                        )
                          .toSorted(([, a], [, b]) => b - a)
                          .map(([method, total]) => (
                            <div
                              key={method}
                              className="flex items-center justify-between"
                            >
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[method] ?? "bg-gray-100 text-gray-700"}`}
                              >
                                {METHOD_LABELS[method] ?? method}
                              </span>
                              <span className="font-mono text-sm font-semibold">
                                {fmt(total)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {c.notes && (
                    <div>
                      <p className="mb-1 text-sm font-semibold">Notes</p>
                      <p className="text-muted-foreground rounded bg-gray-50 px-3 py-2 text-sm">
                        {c.notes}
                      </p>
                    </div>
                  )}

                  {/* Additional info */}
                  {(c.companyName || c.birthDate) && (
                    <div className="grid grid-cols-2 gap-4">
                      {c.companyName && (
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Company
                          </p>
                          <p className="text-sm font-medium">{c.companyName}</p>
                        </div>
                      )}
                      {c.birthDate && (
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Birthday
                          </p>
                          <p className="text-sm font-medium">
                            {fmtDate(c.birthDate)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Purchases tab */}
              {tab === "purchases" && (
                <div className="overflow-x-auto">
                  {data?.recentSales.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 py-12">
                      <ShoppingBag className="h-8 w-8 opacity-40" />
                      <p>No purchases yet.</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-3 font-medium">Receipt #</th>
                          <th className="py-2 pr-3 font-medium">Date</th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Subtotal
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Tax
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Discount
                          </th>
                          <th className="py-2 pr-3 text-right font-medium">
                            Total
                          </th>
                          <th className="py-2 text-right font-medium">
                            Points
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.recentSales.map((sale) => (
                          <tr
                            key={sale.id}
                            className="border-b hover:bg-muted/30"
                          >
                            <td className="py-2 pr-3 font-mono text-xs">
                              {sale.receiptNumber}
                            </td>
                            <td className="text-muted-foreground py-2 pr-3">
                              {fmtDate(sale.saleDate)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {fmt(sale.subtotal)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {fmt(sale.taxAmount)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {Number(sale.discountAmount) > 0
                                ? `-${fmt(sale.discountAmount)}`
                                : "—"}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono font-semibold">
                              {fmt(sale.totalAmount)}
                            </td>
                            <td className="py-2 text-right">
                              {(sale.loyaltyPointsEarned ?? 0) > 0 ? (
                                <span className="inline-flex rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                  +{sale.loyaltyPointsEarned}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold">
                          <td colSpan={5} className="py-2">
                            Total
                          </td>
                          <td className="py-2 text-right font-mono text-green-700">
                            {fmt(
                              data?.recentSales.reduce(
                                (sum, s) => sum + Number(s.totalAmount),
                                0
                              )
                            )}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              )}

              {/* Payments tab */}
              {tab === "payments" && (
                <div className="space-y-6">
                  {/* Sale payments */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sale Payments
                    </p>
                    {(data?.allPayments.length ?? 0) === 0 ? (
                      <p className="text-muted-foreground py-4 text-center text-sm">
                        No sale payments recorded.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2 pr-3 font-medium">Date</th>
                            <th className="py-2 pr-3 font-medium">Receipt #</th>
                            <th className="py-2 pr-3 font-medium">Method</th>
                            <th className="py-2 pr-3 font-medium">Reference</th>
                            <th className="py-2 text-right font-medium">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.allPayments.map((p) => (
                            <tr
                              key={p.id}
                              className="border-b hover:bg-muted/30"
                            >
                              <td className="text-muted-foreground py-2 pr-3">
                                {fmtDate(p.processedAt)}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs">
                                {p.receiptNumber ?? "—"}
                              </td>
                              <td className="py-2 pr-3">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[p.method] ?? "bg-gray-100 text-gray-700"}`}
                                >
                                  {METHOD_LABELS[p.method] ?? p.method}
                                </span>
                                {p.cardType && (
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    {p.cardType}
                                    {p.cardLast4 ? ` ••••${p.cardLast4}` : ""}
                                  </span>
                                )}
                              </td>
                              <td className="text-muted-foreground py-2 pr-3 font-mono text-xs">
                                {p.reference ?? p.authCode ?? "—"}
                              </td>
                              <td className="py-2 text-right font-mono font-semibold">
                                {fmt(p.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Due collections */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Due Collections
                    </p>
                    {(data?.dueCollectionHistory.length ?? 0) === 0 ? (
                      <p className="text-muted-foreground py-4 text-center text-sm">
                        No due collections recorded.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2 pr-3 font-medium">Date</th>
                            <th className="py-2 pr-3 font-medium">Receipt #</th>
                            <th className="py-2 pr-3 font-medium">Method</th>
                            <th className="py-2 pr-3 font-medium">Reference</th>
                            <th className="py-2 text-right font-medium">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.dueCollectionHistory.map((d) => {
                            const isVoided = d.status === "voided";
                            return (
                              <tr
                                key={d.id}
                                className={`border-b hover:bg-muted/30 ${isVoided ? "opacity-50" : ""}`}
                              >
                                <td className="text-muted-foreground py-2 pr-3">
                                  {fmtDate(d.collectedAt)}
                                </td>
                                <td className="py-2 pr-3 font-mono text-xs">
                                  {d.receiptNumber ?? "—"}
                                </td>
                                <td className="py-2 pr-3">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[d.method] ?? "bg-gray-100 text-gray-700"}`}
                                  >
                                    {METHOD_LABELS[d.method] ?? d.method}
                                  </span>
                                  {isVoided && (
                                    <span className="ml-1.5 inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                                      Voided
                                    </span>
                                  )}
                                </td>
                                <td className="text-muted-foreground py-2 pr-3 font-mono text-xs">
                                  {d.reference ?? "—"}
                                </td>
                                <td
                                  className={`py-2 text-right font-mono font-semibold ${isVoided ? "text-muted-foreground line-through" : "text-green-700"}`}
                                >
                                  {fmt(d.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold">
                            <td colSpan={4} className="py-2">
                              Total Collected
                            </td>
                            <td className="py-2 text-right font-mono text-green-700">
                              {fmt(
                                data?.dueCollectionHistory
                                  .filter((d) => d.status !== "voided")
                                  .reduce((sum, d) => sum + Number(d.amount), 0)
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import type { ColumnDef } from "@tanstack/react-table";

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Gift, Plus, Search } from "lucide-react";
import { useState } from "react";

import { GiftCardFormDialog } from "@/components/gift-card-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 20;

function GiftCardsPage() {
  const [cardNumber, setCardNumber] = useState("");
  const [searchedCard, setSearchedCard] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);

  const balanceQuery = useQuery(
    orpc.pos.giftCards.balance.queryOptions({
      enabled: searchedCard.length > 0,
      input: { cardNumber: searchedCard },
      retry: false,
    })
  );

  const listQuery = useQuery(
    orpc.pos.giftCards.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    })
  );

  const handleSearch = () => {
    if (cardNumber.trim()) {
      setSearchedCard(cardNumber.trim());
    }
  };

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  type GiftCardRow = (typeof items)[number];

  const columns: ColumnDef<GiftCardRow>[] = [
    {
      accessorKey: "cardNumber",
      header: "Card Number",
    },
    {
      accessorKey: "initialAmount",
      cell: ({ row }) => `$${Number(row.original.initialAmount).toFixed(2)}`,
      header: "Initial",
    },
    {
      accessorKey: "currentBalance",
      cell: ({ row }) => {
        const bal = Number(row.original.currentBalance);
        const init = Number(row.original.initialAmount);
        return (
          <span
            className={
              bal === 0
                ? "text-muted-foreground"
                : bal < init
                  ? "text-yellow-700 font-medium"
                  : "text-green-700 font-medium"
            }
          >
            ${bal.toFixed(2)}
          </span>
        );
      },
      header: "Balance",
    },
    {
      accessorKey: "isActive",
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.original.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
      header: "Status",
    },
    {
      cell: ({ row }) => {
        const c = row.original.customer;
        if (!c?.firstName) {
          return "—";
        }
        return `${c.firstName} ${c.lastName ?? ""}`.trim();
      },
      header: "Customer",
      id: "customer",
    },
    {
      accessorKey: "expiresAt",
      cell: ({ row }) => {
        if (!row.original.expiresAt) {
          return "No expiry";
        }
        const d = new Date(row.original.expiresAt);
        const expired = d < new Date();
        return (
          <span className={expired ? "text-red-600" : ""}>
            {d.toLocaleDateString()}
            {expired && " (expired)"}
          </span>
        );
      },
      header: "Expires",
    },
    {
      accessorKey: "purchasedAt",
      cell: ({ row }) =>
        row.original.purchasedAt
          ? new Date(row.original.purchasedAt).toLocaleDateString()
          : new Date(row.original.createdAt).toLocaleDateString(),
      header: "Issued",
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gift Cards</h1>
          <p className="text-muted-foreground">Issue and manage gift cards</p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Issue Gift Card
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Check Balance
          </CardTitle>
          <CardDescription>
            Enter a gift card number to check its balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="GC-..."
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="max-w-sm"
            />
            <Button onClick={handleSearch}>Check Balance</Button>
          </div>

          {balanceQuery.isLoading && searchedCard && (
            <p className="text-muted-foreground mt-4 text-sm">Checking...</p>
          )}
          {balanceQuery.isError && searchedCard && (
            <p className="mt-4 text-sm text-red-600">
              Gift card not found or expired.
            </p>
          )}
          {balanceQuery.data && (
            <div className="mt-4 flex items-center gap-4 rounded-lg border bg-green-50 p-4 dark:bg-green-900/20">
              <Gift className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  {balanceQuery.data.cardNumber}
                </p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  ${Number(balanceQuery.data.currentBalance).toFixed(2)}
                </p>
                {balanceQuery.data.expiresAt && (
                  <p className="text-muted-foreground text-xs">
                    Expires:{" "}
                    {new Date(balanceQuery.data.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="Search by card number..."
        pagination={{
          pageCount,
          pageIndex: page,
          pageSize: PAGE_SIZE,
          total,
        }}
        onPaginationChange={(pageIndex) => setPage(pageIndex)}
        loading={listQuery.isLoading}
      />

      <GiftCardFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(newCardNumber) => {
          setCardNumber(newCardNumber);
          setSearchedCard(newCardNumber);
          listQuery.refetch();
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/gift-cards")({
  component: GiftCardsPage,
});

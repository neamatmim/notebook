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
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

function GiftCardsPage() {
  const [cardNumber, setCardNumber] = useState("");
  const [searchedCard, setSearchedCard] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const balanceQuery = useQuery(
    orpc.pos.giftCards.balance.queryOptions({
      enabled: searchedCard.length > 0,
      input: { cardNumber: searchedCard },
    })
  );

  const handleSearch = () => {
    if (cardNumber.trim()) {
      setSearchedCard(cardNumber.trim());
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gift Cards</h1>
          <p className="text-muted-foreground">
            Manage and check gift card balances
          </p>
        </div>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Gift Card
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Check Gift Card Balance
          </CardTitle>
          <CardDescription>
            Enter a gift card number to check its balance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter gift card number (e.g., GC-...)"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="max-w-md"
            />
            <Button onClick={handleSearch}>Check Balance</Button>
          </div>

          {balanceQuery.isLoading && searchedCard && (
            <p className="text-muted-foreground mt-4 text-sm">
              Checking balance...
            </p>
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
                  Card: {balanceQuery.data.cardNumber}
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

      <GiftCardFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(newCardNumber) => {
          setCardNumber(newCardNumber);
          setSearchedCard(newCardNumber);
        }}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/gift-cards")({
  component: GiftCardsPage,
});

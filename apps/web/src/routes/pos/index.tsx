import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Clock,
  CreditCard,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { CartItem } from "@/components/checkout-dialog";

import { CheckoutDialog } from "@/components/checkout-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice?: string | null;
  variantCount?: number | null;
}

function VariantPickerDialog({
  open,
  product,
  onClose,
  onSelect,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSelect: (
    variantId: string,
    variantName: string,
    variantSku: string,
    price: number
  ) => void;
}) {
  const variantsQuery = useQuery({
    ...orpc.inventory.products.variants.list.queryOptions({
      input: { productId: product?.id ?? "" },
    }),
    enabled: open && Boolean(product?.id),
  });

  const variants = variantsQuery.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Variant — {product?.name}</DialogTitle>
        </DialogHeader>
        {variantsQuery.isLoading ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Loading…
          </p>
        ) : variants.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No variants found.
          </p>
        ) : (
          <div className="space-y-2">
            {variants.map((v) => {
              const price = Number(
                v.sellingPrice ?? product?.sellingPrice ?? 0
              );
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    onSelect(v.id, v.name, v.sku, price);
                    onClose();
                  }}
                  className="bg-muted hover:bg-muted/70 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{v.name}</div>
                    <div className="text-muted-foreground text-xs">
                      SKU: {v.sku}
                      {v.attributeType && (
                        <span className="ml-2">
                          {v.attributeType}: {v.attributeValue}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-base font-bold text-green-600">
                    ${price.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function POSTerminal() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationId, setLocationId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] =
    useState<Product | null>(null);

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      input: { limit: 50, query: searchQuery || undefined },
    })
  );

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const shiftsQuery = useQuery(
    orpc.pos.shifts.list.queryOptions({ input: { limit: 50 } })
  );

  const products = productsQuery.data?.items ?? [];
  const locationsList = locationsQuery.data ?? [];
  // Only show open shifts (no endTime) for the selected location
  const openShifts = (shiftsQuery.data?.items ?? []).filter(
    (s) => !s.endTime && (!locationId || s.location?.id === locationId)
  );

  useEffect(() => {
    if (!locationId && locationsQuery.data && locationsQuery.data.length > 0) {
      setLocationId(locationsQuery.data[0].id);
    }
  }, [locationId, locationsQuery.data]);

  // Clear shift selection if it no longer belongs to the new location
  useEffect(() => {
    if (shiftId && locationId) {
      const still = openShifts.find((s) => s.id === shiftId);
      if (!still) {
        setShiftId("");
      }
    }
  }, [locationId, shiftId, openShifts]);

  const addToCart = (
    product: Product,
    variantId?: string,
    variantName?: string,
    variantSku?: string,
    variantPrice?: number
  ) => {
    const cartKey = `${product.id}:${variantId ?? ""}`;
    const displayName = variantName
      ? `${product.name} — ${variantName}`
      : product.name;
    const price = variantPrice ?? Number(product.sellingPrice ?? 0);
    const sku = variantSku ?? product.sku;

    setCart((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
      if (existing) {
        return prev.map((item) =>
          item.cartKey === cartKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          cartKey,
          id: product.id,
          name: displayName,
          price,
          quantity: 1,
          sku,
          variantId,
          variantName,
        },
      ];
    });
  };

  const updateQuantity = (cartKey: string, change: number) => {
    setCart(
      (prev) =>
        prev
          .map((item) => {
            if (item.cartKey === cartKey) {
              const newQty = item.quantity + change;
              return newQty <= 0 ? null : { ...item, quantity: newQty };
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => prev.filter((item) => item.cartKey !== cartKey));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (!locationId) {
      toast.error("Please select a location first");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setCheckoutOpen(true);
  };

  const handleProductClick = (product: (typeof products)[number]) => {
    if (Number(product.variantCount ?? 0) > 0) {
      setVariantPickerProduct(product);
    } else {
      addToCart(product);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Point of Sale Terminal</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <Select
                  value={locationId || "__none__"}
                  onValueChange={(v) =>
                    setLocationId(!v || v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select Location</SelectItem>
                    {locationsList.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <Select
                  value={shiftId || "__none__"}
                  onValueChange={(v) =>
                    setShiftId(!v || v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="No active shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No active shift</SelectItem>
                    {openShifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.employee
                          ? `${s.employee.firstName} ${s.employee.lastName}`
                          : "Unknown"}{" "}
                        —{" "}
                        {new Date(s.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search products by name or SKU..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {productsQuery.isLoading ? (
          <p className="text-muted-foreground py-8 text-center">
            Loading products...
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const hasVariants = Number(product.variantCount ?? 0) > 0;
              return (
                <Card
                  key={product.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-4">
                    <div className="bg-muted mb-3 flex aspect-square items-center justify-center rounded-lg">
                      <Package className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">
                      {product.name}
                    </h3>
                    <p className="text-muted-foreground mb-1 text-xs">
                      SKU: {product.sku}
                    </p>
                    {hasVariants && (
                      <p className="mb-2 text-xs font-medium text-blue-600">
                        {product.variantCount} variant
                        {Number(product.variantCount) !== 1 ? "s" : ""} — tap to
                        choose
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-green-600">
                        ${Number(product.sellingPrice ?? 0).toFixed(2)}
                      </span>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="bg-card w-80 border-l p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shopping Cart</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-6 max-h-64 space-y-3 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <ShoppingCart className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartKey}
                className="bg-muted flex items-center space-x-3 rounded-lg p-3"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{item.name}</h4>
                  <p className="text-muted-foreground text-xs">
                    ${item.price.toFixed(2)} each
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuantity(item.cartKey, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuantity(item.cartKey, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFromCart(item.cartKey)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (8%):</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6">
          <Button
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
            disabled={cart.length === 0 || !locationId}
            onClick={handleCheckout}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Process Payment
          </Button>
        </div>
      </div>

      <VariantPickerDialog
        open={Boolean(variantPickerProduct)}
        product={variantPickerProduct}
        onClose={() => setVariantPickerProduct(null)}
        onSelect={(variantId, variantName, variantSku, price) => {
          if (variantPickerProduct) {
            addToCart(
              variantPickerProduct,
              variantId,
              variantName,
              variantSku,
              price
            );
          }
        }}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => {
          setCheckoutOpen(false);
          clearCart();
        }}
        cart={cart}
        locationId={locationId}
        shiftId={shiftId || undefined}
        subtotal={subtotal}
        tax={tax}
        total={total}
      />
    </div>
  );
}

export const Route = createFileRoute("/pos/")({
  component: POSTerminal,
});

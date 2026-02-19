import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CreditCard,
  DollarSign,
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

import { CheckoutDialog } from "@/components/checkout-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
}

function POSTerminal() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationId, setLocationId] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const productsQuery = useQuery(
    orpc.inventory.products.list.queryOptions({
      input: { limit: 50, query: searchQuery || undefined },
    })
  );

  const locationsQuery = useQuery(
    orpc.inventory.locations.list.queryOptions({})
  );

  const products = productsQuery.data?.items ?? [];
  const locationsList = locationsQuery.data ?? [];

  // Auto-select first location if none selected
  useEffect(() => {
    if (!locationId && locationsQuery.data && locationsQuery.data.length > 0) {
      setLocationId(locationsQuery.data[0].id);
    }
  }, [locationId, locationsQuery.data]);

  const addToCart = (product: (typeof products)[number]) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          id: product.id,
          name: product.name,
          price: Number(product.sellingPrice ?? 0),
          quantity: 1,
          sku: product.sku,
        },
      ];
    });
  };

  const updateQuantity = (id: string, change: number) => {
    setCart(
      (prevCart) =>
        prevCart
          .map((item) => {
            if (item.id === id) {
              const newQuantity = item.quantity + change;
              return newQuantity <= 0
                ? null
                : { ...item, quantity: newQuantity };
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

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

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Point of Sale Terminal</h1>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="border-input bg-background flex h-8 rounded-none border px-2.5 py-1 text-xs outline-none"
              >
                <option value="">Select Location</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
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
            {products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-4">
                  <div className="bg-muted mb-3 flex aspect-square items-center justify-center rounded-lg">
                    <Package className="h-12 w-12 text-gray-400" />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold">{product.name}</h3>
                  <p className="text-muted-foreground mb-2 text-xs">
                    SKU: {product.sku}
                  </p>
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
            ))}
          </div>
        )}
      </div>

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
                key={item.id}
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
                    onClick={() => updateQuantity(item.id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQuantity(item.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFromCart(item.id)}
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

        <div className="mt-6 space-y-3">
          <Button
            className="w-full bg-green-600 text-white hover:bg-green-700"
            size="lg"
            disabled={cart.length === 0 || !locationId}
            onClick={handleCheckout}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Process Payment
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={cart.length === 0 || !locationId}
              onClick={handleCheckout}
            >
              <DollarSign className="mr-1 h-4 w-4" />
              Cash
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={cart.length === 0 || !locationId}
              onClick={handleCheckout}
            >
              <CreditCard className="mr-1 h-4 w-4" />
              Card
            </Button>
          </div>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={() => {
          setCheckoutOpen(false);
          clearCart();
        }}
        cart={cart}
        locationId={locationId}
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

// import currency from "currency.js";
// import type { Any } from "currency.js";

// export const USD = (value: Any) => currency(value);
// export const BDT = (value: Any) => currency(value, { symbol: "৳" });
// export const PESO = (value: Any) => currency(value, { symbol: "₱" });
// export const toCurrency = (value: Any, options?: currency.Options) =>
//   currency(value, options).format();
// const JPY = value => currency(value, { precision: 0, symbol: '¥' });
// const EURO = value => currency(value, { symbol: '€', decimal: ',', separator: '.' });

// USD(1234.567).format(); // => "$1,234.57"
// JPY(1234.567).format(); // => "¥1,235"
// EURO(1234.567).format(); // => "€1.234,57"

// const TRAILING_ZEROS_REGEX = /\.00$/;
// export const toCompactCurrency = (
//   value: Any,
//   options?: currency.Options & { symbol?: string; decimals?: number }
// ) => {
//   const num = currency(value, options).value; // normalized numeric value
//   const symbol = options?.symbol ?? "$";
//   const decimals = options?.decimals ?? 2;

//   let formatted = "";

//   if (Math.abs(num) >= 1.0e9) {
//     formatted = `${(num / 1.0e9).toFixed(decimals).replace(TRAILING_ZEROS_REGEX, "")}B`;
//   } else if (Math.abs(num) >= 1.0e6) {
//     formatted = `${(num / 1.0e6).toFixed(decimals).replace(TRAILING_ZEROS_REGEX, "")}M`;
//   } else if (Math.abs(num) >= 1.0e3) {
//     formatted = `${(num / 1.0e3).toFixed(decimals).replace(TRAILING_ZEROS_REGEX, "")}K`;
//   } else {
//     formatted = num.toFixed(decimals).replace(TRAILING_ZEROS_REGEX, "");
//   }

//   return `${symbol}${formatted}`;
// };

// import { dinero, toDecimal } from "dinero.js";
// import { USD } from "dinero.js/currencies";

export function toCurrency(value: number) {
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

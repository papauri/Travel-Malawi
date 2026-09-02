import React from 'react';
import { formatMoney } from '../lib/currency';
import type { CurrencyCode } from '../types';

interface Props {
  amount: number | null | undefined;
  currency?: CurrencyCode | string;
  className?: string;
}

export default function PriceDisplay({ amount, currency = 'USD', className = '' }: Props) {
  if (amount == null) return null;
  
  const formatted = formatMoney(amount, currency);
  
  const match = formatted.match(/^([^\d]*\s*)([\d.,]+)$/);
  
  if (match) {
    const [, symbol, numbers] = match;
    return (
      <span className={`inline-flex items-baseline font-semibold tabular-nums tracking-tight ${className}`}>
        <span className="text-[0.85em] opacity-75 mr-[0.1em]">{symbol.trim()}</span>
        <span>{numbers}</span>
      </span>
    );
  }
  
  return (
    <span className={`font-semibold tabular-nums tracking-tight ${className}`}>
      {formatted}
    </span>
  );
}

"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DeliverySearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DeliverySearch({ value, onChange, placeholder = "Search invoice, customer..." }: DeliverySearchProps) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

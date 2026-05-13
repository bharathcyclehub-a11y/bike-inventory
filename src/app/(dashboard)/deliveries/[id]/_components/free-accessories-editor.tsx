"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeliveryData } from "./types";

interface FreeAccessoriesEditorProps {
  data: DeliveryData;
  deliveryId: string;
  onSaved: () => void;
  onError: (msg: string) => void;
}

export function FreeAccessoriesEditor({ data, deliveryId, onSaved, onError }: FreeAccessoriesEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.freeAccessories || "");
  const [loading, setLoading] = useState(false);

  const canShow = ["SCHEDULED", "OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status);
  if (!canShow) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeAccessories: value }),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save accessories failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Free Accessories (included with delivery)
        </p>
        {data.freeAccessories && !editing ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-700">{data.freeAccessories}</p>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-600 font-medium">
              Edit
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Lock, Bell, Pump, Toolkit"
              className="text-xs flex-1"
            />
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 shrink-0"
            >
              Save
            </button>
            {editing && (
              <button
                onClick={() => {
                  setValue(data.freeAccessories || "");
                  setEditing(false);
                }}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium shrink-0"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

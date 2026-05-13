"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryData } from "./types";

interface DeliveryDateEditorProps {
  data: DeliveryData;
  deliveryId: string;
  onSaved: () => void;
  onError: (msg: string) => void;
}

export function DeliveryDateEditor({ data, deliveryId, onSaved, onError }: DeliveryDateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [loading, setLoading] = useState(false);

  if (!data.scheduledDate) return null;

  const canEditDate = ["SCHEDULED", "OUT_FOR_DELIVERY", "PACKED", "SHIPPED", "IN_TRANSIT"].includes(data.status);

  const handleSave = async () => {
    if (!newDate) return;
    setLoading(true);
    try {
      await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: newDate }),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Date change failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-3">
      <CardContent className="p-3">
        {editing ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Today", days: 0 },
                { label: "Tomorrow", days: 1 },
                { label: "After 3 days", days: 3 },
                { label: "After a week", days: 7 },
                { label: "After a month", days: 30 },
              ].map((opt) => {
                const d = new Date();
                d.setDate(d.getDate() + opt.days);
                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setNewDate(val)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      newDate === val ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {newDate && (
              <p className="text-xs text-blue-600">
                {new Date(newDate).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!newDate || loading}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-slate-500 text-xs">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 ${canEditDate ? "cursor-pointer" : ""}`}
            onClick={() => {
              if (canEditDate) {
                setNewDate(data.scheduledDate ? data.scheduledDate.slice(0, 10) : "");
                setEditing(true);
              }
            }}
          >
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-slate-700">
              Delivery:{" "}
              <span className="font-medium">
                {new Date(data.scheduledDate).toLocaleDateString("en-IN")}
              </span>
              {data.deliveryNotes && ` \u2014 ${data.deliveryNotes}`}
            </p>
            {canEditDate && <span className="text-xs text-blue-500 ml-auto">tap to change</span>}
          </div>
        )}
        {data.dispatchedAt && (
          <p className="text-xs text-slate-500 ml-6 mt-0.5">
            Dispatched: {new Date(data.dispatchedAt).toLocaleString("en-IN")}
          </p>
        )}
        {data.deliveredAt && (
          <p className="text-xs text-green-600 ml-6 mt-0.5">
            Delivered: {new Date(data.deliveredAt).toLocaleString("en-IN")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const DEPARTMENTS = [
  "Bangalore Delivery",
  "OB Delivery",
  "In store service",
  "EM Service",
  "General Issues",
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const MECHANICS = ["mujahid", "appi", "harisha", "iqbal", "baba", "RANJU R"];

const DELIVERY_ZONES = [
  "Whitefield",
  "Marathahalli",
  "Koramangala",
  "Jayanagar",
  "Banashankari",
  "Electronic City",
  "Hebbal",
  "Yelahanka",
  "Other",
];

const ESTIMATED_DELIVERY = ["Today", "Tomorrow", "After 3 days", "After a week"];

const DELIVERY_DEPARTMENTS = ["Bangalore Delivery", "OB Delivery"];

export default function NewServiceTicketPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [productName, setProductName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issueBrief, setIssueBrief] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [mechanic, setMechanic] = useState("");
  const [salesPerson, setSalesPerson] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [reversePickup, setReversePickup] = useState(false);
  const [freeAccessories, setFreeAccessories] = useState("");

  const isDeliveryDept = DELIVERY_DEPARTMENTS.includes(department);

  useEffect(() => {
    fetch("/api/users?limit=50")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const eligible = (res.data || []).filter((u: UserOption) =>
            ["ADMIN", "ACCOUNTS_MANAGER", "OUTWARDS_CLERK"].includes(u.role)
          );
          setUsers(eligible);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !productName.trim() || !issueBrief.trim() || !department) {
      setError("Please fill all required fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        productName: productName.trim(),
        invoiceNo: invoiceNo.trim() || undefined,
        issueBrief: issueBrief.trim(),
        department,
        priority,
        mechanic: mechanic || undefined,
        salesPerson: salesPerson.trim() || undefined,
        assignedToId: assignedToId || undefined,
        reversePickup,
        freeAccessories: freeAccessories.trim() || undefined,
      };

      if (isDeliveryDept) {
        body.deliveryZone = deliveryZone || undefined;
        body.deliveryAddress = deliveryAddress.trim() || undefined;
        body.estimatedDelivery = estimatedDelivery || undefined;
      }

      const res = await fetch("/api/service-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create ticket");
      router.push(`/service/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/service" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">New Service Ticket</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer name"
            className={inputClass}
          />
        </div>

        {/* Customer Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Customer Phone *
          </label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="10-digit phone number"
            className={inputClass}
          />
        </div>

        {/* Alternate Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Alternate Phone
          </label>
          <input
            type="tel"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            placeholder="Optional alternate number"
            className={inputClass}
          />
        </div>

        {/* Product Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Bicycle / accessory name"
            className={inputClass}
          />
        </div>

        {/* Invoice No */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Invoice No
          </label>
          <input
            type="text"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="Zoho invoice number"
            className={inputClass}
          />
        </div>

        {/* Issue Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Issue Description *
          </label>
          <textarea
            value={issueBrief}
            onChange={(e) => setIssueBrief(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows={3}
            className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Department *
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputClass}
          >
            <option value="">Select department...</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  priority === p
                    ? p === "LOW"
                      ? "bg-slate-100 text-slate-700 border-slate-300"
                      : p === "NORMAL"
                      ? "bg-blue-100 text-blue-700 border-blue-200"
                      : p === "HIGH"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-red-100 text-red-700 border-red-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Assigned Mechanic */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Assigned Mechanic
          </label>
          <select
            value={mechanic}
            onChange={(e) => setMechanic(e.target.value)}
            className={inputClass}
          >
            <option value="">Select mechanic...</option>
            {MECHANICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Sales Person */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sales Person
          </label>
          <input
            type="text"
            value={salesPerson}
            onChange={(e) => setSalesPerson(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>

        {/* Assign To */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Assign To
          </label>
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            className={inputClass}
          >
            <option value="">Select team member...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>

        {/* Delivery Zone — only for delivery departments */}
        {isDeliveryDept && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Delivery Zone
            </label>
            <select
              value={deliveryZone}
              onChange={(e) => setDeliveryZone(e.target.value)}
              className={inputClass}
            >
              <option value="">Select zone...</option>
              {DELIVERY_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Delivery Address — only for delivery departments */}
        {isDeliveryDept && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Delivery Address
            </label>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Full delivery address..."
              rows={2}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        )}

        {/* Estimated Delivery */}
        {isDeliveryDept && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Estimated Delivery
            </label>
            <select
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              className={inputClass}
            >
              <option value="">Select timeline...</option>
              {ESTIMATED_DELIVERY.map((ed) => (
                <option key={ed} value={ed}>
                  {ed}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reverse Pickup */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={reversePickup}
              onChange={(e) => setReversePickup(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-slate-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" />
          </label>
          <span className="text-sm text-slate-700">Reverse Pickup</span>
        </div>

        {/* Free Accessories */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Free Accessories
          </label>
          <input
            type="text"
            value={freeAccessories}
            onChange={(e) => setFreeAccessories(e.target.value)}
            placeholder="e.g. Bell, Lock, Stand"
            className={inputClass}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={
            !customerName.trim() ||
            !customerPhone.trim() ||
            !productName.trim() ||
            !issueBrief.trim() ||
            !department ||
            submitting
          }
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {submitting ? "Creating..." : "Create Ticket"}
        </Button>
      </form>
    </div>
  );
}

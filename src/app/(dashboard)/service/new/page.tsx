"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Plus, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils";

interface ServiceCustomer {
  id: string;
  name: string;
  phone: string;
  bikes: { id: string; brand: string; model: string; size: string | null; color: string | null }[];
}

interface MechanicOption {
  id: string;
  name: string;
}

type Step = "customer" | "bike" | "job";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export default function NewServiceJobPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Customer step
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<ServiceCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ServiceCustomer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const debouncedSearch = useDebounce(customerSearch);

  // Bike step
  const [selectedBikeId, setSelectedBikeId] = useState("");
  const [showNewBike, setShowNewBike] = useState(false);
  const [bikeBrand, setBikeBrand] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [bikeSize, setBikeSize] = useState("");
  const [bikeColor, setBikeColor] = useState("");
  const [bikeSerial, setBikeSerial] = useState("");

  // Job step
  const [complaint, setComplaint] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [assignedToId, setAssignedToId] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [notes, setNotes] = useState("");
  const [mechanics, setMechanics] = useState<MechanicOption[]>([]);

  // Search customers
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setCustomers([]);
      return;
    }
    setSearching(true);
    fetch(`/api/service/customers?search=${encodeURIComponent(debouncedSearch)}&limit=10`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCustomers(res.data);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [debouncedSearch]);

  // Load mechanics
  useEffect(() => {
    fetch("/api/users?limit=50")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setMechanics(
            (res.data || []).filter((u: { role: string }) => u.role === "MECHANIC")
          );
        }
      })
      .catch(() => {});
  }, []);

  async function handleSelectCustomer(c: ServiceCustomer) {
    setSelectedCustomer(c);
    // Fetch full customer with bikes
    const res = await fetch(`/api/service/customers/${c.id}`);
    const data = await res.json();
    if (data.success) {
      setSelectedCustomer(data.data);
    }
    setStep("bike");
  }

  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) {
      setError("Name and phone required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/service/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          whatsapp: newWhatsapp.trim() || undefined,
          address: newAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setSelectedCustomer(data.data);
      setStep("bike");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddBike() {
    if (!selectedCustomer || !bikeBrand.trim() || !bikeModel.trim()) {
      setError("Brand and model required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/service/customers/${selectedCustomer.id}/bikes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: bikeBrand.trim(),
          model: bikeModel.trim(),
          size: bikeSize.trim() || undefined,
          color: bikeColor.trim() || undefined,
          serialNo: bikeSerial.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      setSelectedBikeId(data.data.id);
      // Refresh customer bikes
      const custRes = await fetch(`/api/service/customers/${selectedCustomer.id}`);
      const custData = await custRes.json();
      if (custData.success) setSelectedCustomer(custData.data);
      setShowNewBike(false);
      setStep("job");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateJob() {
    if (!selectedCustomer || !complaint.trim()) {
      setError("Complaint description required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        customerId: selectedCustomer.id,
        complaint: complaint.trim(),
        priority,
      };
      if (selectedBikeId) body.bikeId = selectedBikeId;
      if (assignedToId) body.assignedToId = assignedToId;
      if (estimatedCompletion) body.estimatedCompletion = estimatedCompletion;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch("/api/service/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed");
      router.push(`/service/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
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
        <h1 className="text-lg font-bold text-slate-900">New Service Job</h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {["customer", "bike", "job"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? "bg-slate-900 text-white"
                  : ["customer", "bike", "job"].indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="w-8 h-0.5 bg-slate-200" />}
          </div>
        ))}
        <span className="text-xs text-slate-500 ml-2 capitalize">{step}</span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}

      {/* STEP 1: Customer */}
      {step === "customer" && (
        <div className="space-y-4">
          {!showNewCustomer ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search customer by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {searching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}

              {customers.length > 0 && (
                <div className="space-y-1.5">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.phone}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {debouncedSearch.length >= 2 && !searching && customers.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No customers found</p>
              )}

              <button
                onClick={() => setShowNewCustomer(true)}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-4 w-4" /> New Customer
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="10-digit phone" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                <input type="tel" value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="Same as phone if blank" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Customer address" rows={2} className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNewCustomer(false)} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleCreateCustomer} disabled={submitting || !newName.trim() || !newPhone.trim()} className="flex-1 bg-slate-900">
                  {submitting ? "Creating..." : "Create & Continue"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Bike */}
      {step === "bike" && selectedCustomer && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 mb-2">
            <p className="text-sm font-medium text-slate-900">{selectedCustomer.name}</p>
            <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
          </div>

          {selectedCustomer.bikes && selectedCustomer.bikes.length > 0 && !showNewBike && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase">Select Bike</p>
              <div className="space-y-1.5">
                {selectedCustomer.bikes.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setSelectedBikeId(b.id); setStep("job"); }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedBikeId === b.id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {b.brand} {b.model}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[b.size, b.color].filter(Boolean).join(" | ") || "No details"}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {!showNewBike ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewBike(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100"
              >
                <Plus className="h-4 w-4" /> Add Bike
              </button>
              <button
                onClick={() => setStep("job")}
                className="flex-1 py-3 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Skip Bike
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase">New Bike</p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand *</label>
                <input type="text" value={bikeBrand} onChange={(e) => setBikeBrand(e.target.value)} placeholder="e.g. Hero, Firefox, Trek" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model *</label>
                <input type="text" value={bikeModel} onChange={(e) => setBikeModel(e.target.value)} placeholder="e.g. Sprint Pro 26T" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                  <select value={bikeSize} onChange={(e) => setBikeSize(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {["12\"", "16\"", "20\"", "24\"", "26\"", "27.5\"", "29\"", "700c"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                  <input type="text" value={bikeColor} onChange={(e) => setBikeColor(e.target.value)} placeholder="e.g. Red" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Serial / Frame No</label>
                <input type="text" value={bikeSerial} onChange={(e) => setBikeSerial(e.target.value)} placeholder="Optional" className={inputClass} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNewBike(false)} className="flex-1">Back</Button>
                <Button onClick={handleAddBike} disabled={submitting || !bikeBrand.trim() || !bikeModel.trim()} className="flex-1 bg-slate-900">
                  {submitting ? "Adding..." : "Add Bike & Continue"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3: Job Details */}
      {step === "job" && selectedCustomer && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-900">{selectedCustomer.name}</p>
            <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
            {selectedBikeId && selectedCustomer.bikes && (
              <p className="text-xs text-blue-600 mt-0.5">
                {selectedCustomer.bikes.find((b) => b.id === selectedBikeId)
                  ? `${selectedCustomer.bikes.find((b) => b.id === selectedBikeId)!.brand} ${selectedCustomer.bikes.find((b) => b.id === selectedBikeId)!.model}`
                  : ""}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Complaint / Issue *</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Describe the issue (e.g., brakes not working, wheel wobble, chain slipping)"
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

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
                      ? p === "LOW" ? "bg-slate-100 text-slate-700 border-slate-300"
                      : p === "NORMAL" ? "bg-blue-100 text-blue-700 border-blue-200"
                      : p === "HIGH" ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-red-100 text-red-700 border-red-200"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign Mechanic</label>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Completion</label>
            <input
              type="date"
              value={estimatedCompletion}
              onChange={(e) => setEstimatedCompletion(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("bike")} className="flex-1">Back</Button>
            <Button
              onClick={handleCreateJob}
              disabled={submitting || !complaint.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Phone, MessageCircle, Wrench, Send, Loader2,
  Plus, Trash2, CheckCircle2, User, Package, IndianRupee,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface JobItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product: { id: string; name: string; sku: string; currentStock: number } | null;
}

interface JobNote {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  createdBy: { name: string } | null;
}

interface JobInvoice {
  id: string;
  invoiceNo: string;
  amount: number;
  discount: number;
  netAmount: number;
  paidAmount: number;
  paymentMode: string | null;
  status: string;
}

interface JobDetail {
  id: string;
  jobNo: string;
  complaint: string;
  diagnosis: string | null;
  status: string;
  priority: string;
  estimatedCost: number;
  actualCost: number;
  discount: number;
  estimatedCompletion: string | null;
  notes: string | null;
  ticketId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string; whatsapp: string | null; address: string | null };
  bike: { id: string; brand: string; model: string; size: string | null; color: string | null } | null;
  assignedTo: { id: string; name: string } | null;
  items: JobItem[];
  jobNotes: JobNote[];
  invoice: JobInvoice | null;
}

interface MechanicOption { id: string; name: string; }

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  CREATED: "default", DIAGNOSED: "info", QUOTED: "warning", APPROVED: "info",
  IN_PROGRESS: "warning", COMPLETED: "success", INVOICED: "success",
  DELIVERED: "success", ON_HOLD: "danger", CANCELLED: "danger",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  CREATED: ["DIAGNOSED", "ON_HOLD", "CANCELLED"],
  DIAGNOSED: ["QUOTED", "ON_HOLD", "CANCELLED"],
  QUOTED: ["APPROVED", "ON_HOLD", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
  COMPLETED: ["INVOICED"],
  INVOICED: ["DELIVERED"],
  ON_HOLD: ["CREATED", "DIAGNOSED", "QUOTED", "APPROVED", "IN_PROGRESS"],
  CANCELLED: [],
  DELIVERED: [],
};

const STATUS_STEPS = ["CREATED", "DIAGNOSED", "QUOTED", "APPROVED", "IN_PROGRESS", "COMPLETED", "INVOICED", "DELIVERED"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ServiceJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";
  const id = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mechanics, setMechanics] = useState<MechanicOption[]>([]);

  // Status update
  const [updating, setUpdating] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");

  // Add item
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemType, setItemType] = useState("PART");
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<{ id: string; name: string; sku: string; sellingPrice: number; currentStock: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  // Invoice
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [paying, setPaying] = useState(false);

  const fetchJob = useCallback(() => {
    setLoading(true);
    fetch(`/api/service/jobs/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setJob(res.data);
          setDiagnosis(res.data.diagnosis || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  useEffect(() => {
    fetch("/api/users?limit=50")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setMechanics((res.data || []).filter((u: { role: string }) => u.role === "MECHANIC"));
      })
      .catch(() => {});
  }, []);

  // Product search for adding parts
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=5&status=ACTIVE`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setProductResults(res.data || []); })
      .catch(() => {});
  }, [productSearch]);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "DIAGNOSED" && diagnosis.trim()) body.diagnosis = diagnosis.trim();

      const res = await fetch(`/api/service/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) fetchJob();
    } catch {}
    finally { setUpdating(false); }
  }

  async function handleAssign(mechanicId: string) {
    setUpdating(true);
    try {
      await fetch(`/api/service/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: mechanicId || null }),
      });
      fetchJob();
    } catch {}
    finally { setUpdating(false); }
  }

  async function handleAddItem() {
    if (!itemDesc.trim() || itemPrice <= 0) return;
    setAddingItem(true);
    try {
      const body: Record<string, unknown> = {
        type: itemType, description: itemDesc.trim(), quantity: itemQty, unitPrice: itemPrice,
      };
      if (selectedProductId) body.productId = selectedProductId;

      await fetch(`/api/service/jobs/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowAddItem(false);
      setItemDesc(""); setItemQty(1); setItemPrice(0); setSelectedProductId(""); setProductSearch("");
      fetchJob();
    } catch {}
    finally { setAddingItem(false); }
  }

  async function handleRemoveItem(itemId: string) {
    await fetch(`/api/service/jobs/${id}/items?itemId=${itemId}`, { method: "DELETE" });
    fetchJob();
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      await fetch(`/api/service/jobs/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      setNoteText("");
      fetchJob();
    } catch {}
    finally { setSendingNote(false); }
  }

  async function handleGenerateInvoice() {
    setGeneratingInvoice(true);
    try {
      await fetch(`/api/service/jobs/${id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      fetchJob();
    } catch {}
    finally { setGeneratingInvoice(false); }
  }

  async function handlePayment() {
    if (paymentAmount <= 0) return;
    setPaying(true);
    try {
      await fetch(`/api/service/jobs/${id}/invoice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: paymentAmount, paymentMode }),
      });
      fetchJob();
    } catch {}
    finally { setPaying(false); }
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;

  if (!job) {
    return (
      <div className="text-center py-12">
        <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Job not found</p>
        <Link href="/service" className="text-sm text-blue-600 mt-2 inline-block">Back to list</Link>
      </div>
    );
  }

  const phone = job.customer.phone?.replace(/\D/g, "") || "";
  const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(`Hi ${job.customer.name}, update on your service job ${job.jobNo}: Status is ${job.status.replace(/_/g, " ")}. We'll keep you posted!`)}`;
  const transitions = STATUS_TRANSITIONS[job.status] || [];
  const currentStepIndex = STATUS_STEPS.indexOf(job.status);
  const inputClass = "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/service" className="p-1"><ArrowLeft className="h-5 w-5 text-slate-600" /></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{job.jobNo}</h1>
            <Badge variant={STATUS_VARIANT[job.status] || "default"} className="text-[10px]">{job.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Created {timeAgo(job.createdAt)}</p>
        </div>
      </div>

      {/* Status Stepper */}
      {job.status !== "ON_HOLD" && job.status !== "CANCELLED" && (
        <div className="overflow-x-auto scrollbar-hide mb-3">
          <div className="flex items-center gap-0 min-w-max px-1 py-2">
            {STATUS_STEPS.map((s, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={s} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      isCompleted ? "bg-green-500 text-white"
                        : isCurrent ? "bg-blue-600 text-white ring-2 ring-blue-200"
                        : "bg-slate-200 text-slate-400"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                    </div>
                    <p className={`text-[7px] mt-0.5 max-w-[48px] text-center leading-tight ${
                      isCurrent ? "text-blue-700 font-semibold" : isCompleted ? "text-green-600" : "text-slate-400"
                    }`}>{s.replace(/_/g, " ")}</p>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 mt-[-12px] ${i < currentStepIndex ? "bg-green-400" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer Card */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Customer</p>
          <p className="text-sm font-medium text-slate-900">{job.customer.name}</p>
          <p className="text-xs text-slate-500">{job.customer.phone}</p>
          {job.bike && (
            <p className="text-xs text-blue-600 mt-1">{job.bike.brand} {job.bike.model} {job.bike.size ? `(${job.bike.size})` : ""} {job.bike.color || ""}</p>
          )}
          <div className="flex gap-2 mt-2">
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <a href={`tel:${phone}`} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium">
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Issue & Diagnosis */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Issue</p>
          <p className="text-sm text-slate-800">{job.complaint}</p>
          {job.diagnosis && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">Diagnosis</p>
              <p className="text-sm text-slate-800">{job.diagnosis}</p>
            </div>
          )}
          {job.status === "CREATED" && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <label className="block text-xs text-slate-500 mb-1">Add Diagnosis</label>
              <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Mechanic's findings..." rows={2}
                className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Assignment</p>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <select value={job.assignedTo?.id || ""} onChange={(e) => handleAssign(e.target.value)}
              disabled={updating}
              className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900">
              <option value="">Unassigned</option>
              {mechanics.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Status Actions */}
      {transitions.length > 0 && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Actions</p>
            <div className="flex flex-wrap gap-2">
              {transitions.map((s) => (
                <Button key={s} size="sm" onClick={() => handleStatusChange(s)} disabled={updating}
                  className={`text-xs ${
                    s === "CANCELLED" ? "bg-red-600 hover:bg-red-700" :
                    s === "ON_HOLD" ? "bg-amber-600 hover:bg-amber-700" :
                    s === "COMPLETED" || s === "DELIVERED" ? "bg-green-600 hover:bg-green-700" :
                    "bg-slate-900"
                  }`}>
                  {updating ? "..." : s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts & Labour */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Parts & Labour</p>
            {!["DELIVERED", "CANCELLED", "INVOICED"].includes(job.status) && (
              <button onClick={() => setShowAddItem(!showAddItem)} className="text-blue-600">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {showAddItem && (
            <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
              <div className="flex gap-2">
                {["PART", "LABOUR", "ACCESSORY"].map((t) => (
                  <button key={t} onClick={() => setItemType(t)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                      itemType === t ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600"
                    }`}>{t}</button>
                ))}
              </div>
              {itemType === "PART" && (
                <div>
                  <input type="text" value={productSearch} onChange={(e) => { setProductSearch(e.target.value); setSelectedProductId(""); }}
                    placeholder="Search part by name/SKU..." className={inputClass} />
                  {productResults.length > 0 && !selectedProductId && (
                    <div className="mt-1 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                      {productResults.map((p) => (
                        <button key={p.id} onClick={() => {
                          setSelectedProductId(p.id);
                          setItemDesc(p.name);
                          setItemPrice(p.sellingPrice);
                          setProductSearch(p.name);
                        }} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-0">
                          <span className="font-medium">{p.name}</span> <span className="text-slate-400">({p.sku})</span>
                          <span className="text-slate-500 ml-1">Stock: {p.currentStock}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <input type="text" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)}
                placeholder={itemType === "LABOUR" ? "e.g. Wheel truing, Brake adjustment" : "Part description"} className={inputClass} />
              <div className="flex gap-2">
                <div className="w-20">
                  <label className="text-[10px] text-slate-500">Qty</label>
                  <input type="number" value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} min={1} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500">Price (₹)</label>
                  <input type="number" value={itemPrice} onChange={(e) => setItemPrice(Number(e.target.value))} min={0} className={inputClass} />
                </div>
                <div className="flex items-end">
                  <Button size="sm" onClick={handleAddItem} disabled={addingItem || !itemDesc.trim() || itemPrice <= 0} className="bg-slate-900">
                    {addingItem ? "..." : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {job.items.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">No items added yet</p>
          ) : (
            <div className="space-y-1.5">
              {job.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={item.type === "LABOUR" ? "warning" : item.type === "ACCESSORY" ? "info" : "default"} className="text-[9px] px-1.5 py-0">
                        {item.type}
                      </Badge>
                      <span className="text-xs font-medium text-slate-900 truncate">{item.description}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{item.quantity} x ₹{item.unitPrice} = ₹{item.total}</p>
                  </div>
                  {!["DELIVERED", "CANCELLED", "INVOICED"].includes(job.status) && (
                    <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-slate-200 flex justify-between">
                <span className="text-xs font-semibold text-slate-600">Total</span>
                <span className="text-sm font-bold text-slate-900">₹{job.actualCost.toLocaleString("en-IN")}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice */}
      {(job.status === "COMPLETED" || job.status === "INVOICED" || job.status === "DELIVERED") && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Invoice</p>
            {!job.invoice && job.status === "COMPLETED" && (
              <Button size="sm" onClick={handleGenerateInvoice} disabled={generatingInvoice} className="w-full bg-green-600 hover:bg-green-700">
                <IndianRupee className="h-3.5 w-3.5 mr-1" />
                {generatingInvoice ? "Generating..." : "Generate Invoice"}
              </Button>
            )}
            {job.invoice && (
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-xs text-slate-500">Invoice #</span><span className="text-xs font-medium">{job.invoice.invoiceNo}</span></div>
                <div className="flex justify-between"><span className="text-xs text-slate-500">Amount</span><span className="text-xs font-medium">₹{job.invoice.amount.toLocaleString("en-IN")}</span></div>
                {job.invoice.discount > 0 && <div className="flex justify-between"><span className="text-xs text-slate-500">Discount</span><span className="text-xs font-medium text-green-600">-₹{job.invoice.discount.toLocaleString("en-IN")}</span></div>}
                <div className="flex justify-between"><span className="text-xs text-slate-500 font-semibold">Net</span><span className="text-sm font-bold">₹{job.invoice.netAmount.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span className="text-xs text-slate-500">Paid</span><span className="text-xs font-medium text-green-600">₹{job.invoice.paidAmount.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Status</span>
                  <Badge variant={job.invoice.status === "PAID" ? "success" : "warning"} className="text-[10px]">{job.invoice.status}</Badge>
                </div>
                {job.invoice.status !== "PAID" && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex gap-2">
                      <input type="number" value={paymentAmount || ""} onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        placeholder="Amount" className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs" />
                      <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-24 h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs">
                        {["CASH", "UPI", "NEFT", "CHEQUE"].map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <Button size="sm" onClick={handlePayment} disabled={paying || paymentAmount <= 0} className="bg-green-600">
                        {paying ? "..." : "Pay"}
                      </Button>
                    </div>
                    <button onClick={() => setPaymentAmount(job.invoice!.netAmount - job.invoice!.paidAmount)}
                      className="text-[10px] text-blue-600 underline">
                      Pay full balance (₹{(job.invoice.netAmount - job.invoice.paidAmount).toLocaleString("en-IN")})
                    </button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Timeline ({job.jobNotes.length})</p>
          {job.jobNotes.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No notes yet</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
              {[...job.jobNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((note) => (
                <div key={note.id} className="border-l-2 border-slate-200 pl-2.5 py-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge variant={note.type === "STATUS_CHANGE" ? "info" : note.type === "DIAGNOSIS" ? "warning" : "default"} className="text-[9px] px-1.5 py-0">
                      {note.type.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-[10px] text-slate-400">{note.createdBy?.name || "System"} | {timeAgo(note.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-700">{note.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
              placeholder="Add a note..." className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900" />
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || sendingNote} className="bg-slate-900">
              {sendingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete (admin only) */}
      {isAdmin && job.status === "CREATED" && (
        <div className="mb-6">
          <button onClick={() => { if (confirm(`Delete job ${job.jobNo}?`)) { fetch(`/api/service/jobs/${id}`, { method: "DELETE" }).then(() => router.push("/service")); } }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100">
            <Trash2 className="h-4 w-4" /> Delete Job
          </button>
        </div>
      )}
    </div>
  );
}

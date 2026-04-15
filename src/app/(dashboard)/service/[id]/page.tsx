"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Phone, MessageCircle, Wrench, Send,
  Loader2, Trash2, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Note {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: { name: string } | null;
}

interface TicketDetail {
  id: string;
  ticketNo: string;
  customerName: string;
  customerPhone: string;
  alternatePhone: string | null;
  customerAddress: string | null;
  customerPincode: string | null;
  productName: string;
  invoiceNo: string | null;
  issueBrief: string;
  department: string;
  status: string;
  priority: string;
  mechanic: string | null;
  salesPerson: string | null;
  emTicketStatus: string | null;
  pendingFrom: string | null;
  delayReason: string | null;
  deliveryZone: string | null;
  deliveryAddress: string | null;
  estimatedDelivery: string | null;
  reversePickup: boolean;
  freeAccessories: string | null;
  assignedTo: { id: string; name: string } | null;
  notes: Note[];
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_VARIANT: Record<string, "default" | "info" | "warning" | "danger"> = {
  LOW: "default",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

const STATUS_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  TICKET_ISSUED: "info",
  ESCALATED: "danger",
  RESOLUTION_DELAYED: "warning",
  RESOLVED: "success",
};

const NOTE_TYPE_VARIANT: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  NOTE: "default",
  STATUS_CHANGE: "info",
  ASSIGNMENT: "info",
  ESCALATION: "danger",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  TICKET_ISSUED: ["ESCALATED", "RESOLVED", "RESOLUTION_DELAYED"],
  ESCALATED: ["RESOLVED", "RESOLUTION_DELAYED"],
  RESOLUTION_DELAYED: ["ESCALATED", "RESOLVED"],
  RESOLVED: [],
};

const EM_STEPS = [
  "OPEN",
  "APPROVAL_PENDING",
  "EVIDENCE_PENDING",
  "DISPATCH_PENDING",
  "IN_TRANSIT_TO_BCH",
  "DELIVERED_TO_BCH",
  "IN_TRANSIT_TO_CUSTOMER",
  "CLOSED",
];

const DELAY_REASONS = [
  "Client not responding",
  "Rejected for warranty",
  "Not ready to support",
  "Manager delay",
  "Order cancelled",
];

const PENDING_FROM_OPTIONS = ["EM", "CLIENT", "BCH"];

const DELIVERY_DEPARTMENTS = ["Bangalore Delivery", "OB Delivery"];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ServiceTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role || "";
  const isAdmin = role === "ADMIN";
  const id = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [newEmStatus, setNewEmStatus] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [pendingFrom, setPendingFrom] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchTicket = useCallback(() => {
    setLoading(true);
    fetch(`/api/service-tickets/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setTicket(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const res = await fetch(`/api/service-tickets/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNoteText("");
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setSendingNote(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      const body: Record<string, unknown> = { status: newStatus };
      if (newStatus === "RESOLUTION_DELAYED" && delayReason) {
        body.delayReason = delayReason;
      }
      if (pendingFrom) {
        body.pendingFrom = pendingFrom;
      }

      const res = await fetch(`/api/service-tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setNewStatus("");
        setDelayReason("");
        setPendingFrom("");
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateEmStatus = async () => {
    if (!newEmStatus) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/service-tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emTicketStatus: newEmStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setNewEmStatus("");
        fetchTicket();
      }
    } catch {
      // ignore
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/service-tickets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) router.push("/service");
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <Wrench className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Ticket not found</p>
        <Link href="/service" className="text-sm text-blue-600 mt-2 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  const phone = ticket.customerPhone?.replace(/\D/g, "") || "";
  const altPhone = ticket.alternatePhone?.replace(/\D/g, "") || "";
  const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(
    `Hi ${ticket.customerName}, regarding your service ticket ${ticket.ticketNo} — status: ${ticket.status.replace(/_/g, " ")}. Please let us know if you need any update.`
  )}`;
  const transitions = STATUS_TRANSITIONS[ticket.status] || [];
  const isEmDept = ticket.department === "EM Service";
  const isDeliveryDept = DELIVERY_DEPARTMENTS.includes(ticket.department);

  // EM stepper: find current step index
  const currentEmIndex = ticket.emTicketStatus
    ? EM_STEPS.indexOf(ticket.emTicketStatus)
    : -1;
  const nextEmStep =
    currentEmIndex >= 0 && currentEmIndex < EM_STEPS.length - 1
      ? EM_STEPS[currentEmIndex + 1]
      : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/service" className="p-1">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{ticket.ticketNo}</h1>
            <Badge
              variant={STATUS_VARIANT[ticket.status] || "default"}
              className="text-[10px]"
            >
              {ticket.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant={PRIORITY_VARIANT[ticket.priority] || "default"}
              className="text-[10px]"
            >
              {ticket.priority}
            </Badge>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Created {timeAgo(ticket.createdAt)} | Updated {timeAgo(ticket.updatedAt)}
          </p>
        </div>
      </div>

      {/* Customer Section */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Customer</p>
          <p className="text-sm font-medium text-slate-900">{ticket.customerName}</p>
          <div className="flex items-center gap-2 mt-1">
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 text-xs text-blue-600"
            >
              <Phone className="h-3 w-3" />
              {ticket.customerPhone}
            </a>
            {altPhone && (
              <a
                href={`tel:${altPhone}`}
                className="text-xs text-slate-500"
              >
                | Alt: {ticket.alternatePhone}
              </a>
            )}
          </div>
          {ticket.customerAddress && (
            <p className="text-xs text-slate-500 mt-1">
              {ticket.customerAddress}
              {ticket.customerPincode && ` - ${ticket.customerPincode}`}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Issue Section */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Issue Details</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Product</span>
              <span className="text-xs font-medium text-slate-900">{ticket.productName}</span>
            </div>
            {ticket.invoiceNo && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Invoice</span>
                <span className="text-xs font-medium text-slate-900">{ticket.invoiceNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Department</span>
              <span className="text-xs font-medium text-slate-900">{ticket.department}</span>
            </div>
            {ticket.mechanic && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Mechanic</span>
                <span className="text-xs font-medium text-slate-900">{ticket.mechanic}</span>
              </div>
            )}
            {ticket.salesPerson && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Sales Person</span>
                <span className="text-xs font-medium text-slate-900">{ticket.salesPerson}</span>
              </div>
            )}
            {ticket.assignedTo && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Assigned To</span>
                <span className="text-xs font-medium text-slate-900">
                  {ticket.assignedTo.name}
                </span>
              </div>
            )}
            {ticket.freeAccessories && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Free Accessories</span>
                <span className="text-xs font-medium text-slate-900">
                  {ticket.freeAccessories}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-0.5">Issue</p>
            <p className="text-sm text-slate-800">{ticket.issueBrief}</p>
          </div>
        </CardContent>
      </Card>

      {/* Status Flow Section */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Status Flow</p>

          {/* Current status */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-slate-900">Current:</span>
            <Badge
              variant={STATUS_VARIANT[ticket.status] || "default"}
              className="text-xs"
            >
              {ticket.status.replace(/_/g, " ")}
            </Badge>
          </div>

          {/* EM Stepper */}
          {isEmDept && ticket.emTicketStatus && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-2">EM Pipeline</p>
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-0 min-w-max">
                  {EM_STEPS.map((step, i) => {
                    const isCompleted = i < currentEmIndex;
                    const isCurrent = i === currentEmIndex;
                    return (
                      <div key={step} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                              isCompleted
                                ? "bg-green-500 text-white"
                                : isCurrent
                                ? "bg-blue-600 text-white ring-2 ring-blue-200"
                                : "bg-slate-200 text-slate-400"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          <p
                            className={`text-[8px] mt-0.5 max-w-[52px] text-center leading-tight ${
                              isCurrent
                                ? "text-blue-700 font-semibold"
                                : isCompleted
                                ? "text-green-600"
                                : "text-slate-400"
                            }`}
                          >
                            {step.replace(/_/g, " ")}
                          </p>
                        </div>
                        {i < EM_STEPS.length - 1 && (
                          <div
                            className={`w-4 h-0.5 mx-0.5 mt-[-12px] ${
                              i < currentEmIndex ? "bg-green-400" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Pending From */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500">Pending from:</span>
            <select
              value={pendingFrom || ticket.pendingFrom || ""}
              onChange={(e) => setPendingFrom(e.target.value)}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">None</option>
              {PENDING_FROM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Update Main Status */}
          {transitions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500">Update Status</p>
              <div className="flex gap-2">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Select new status...</option>
                  {transitions.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || updating}
                  className="bg-slate-900 text-white text-xs"
                >
                  {updating ? "..." : "Update"}
                </Button>
              </div>

              {/* Delay reason dropdown */}
              {newStatus === "RESOLUTION_DELAYED" && (
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Select delay reason...</option>
                  {DELAY_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Update EM Status */}
          {isEmDept && nextEmStep && (
            <div className="space-y-2 pt-2 border-t border-slate-100 mt-2">
              <p className="text-xs text-slate-500">Update EM Status</p>
              <div className="flex gap-2">
                <select
                  value={newEmStatus}
                  onChange={(e) => setNewEmStatus(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Select next EM step...</option>
                  <option value={nextEmStep}>
                    {nextEmStep.replace(/_/g, " ")}
                  </option>
                </select>
                <Button
                  size="sm"
                  onClick={handleUpdateEmStatus}
                  disabled={!newEmStatus || updating}
                  className="bg-purple-600 text-white text-xs"
                >
                  {updating ? "..." : "Update EM"}
                </Button>
              </div>
            </div>
          )}

          {/* Delay reason display */}
          {ticket.status === "RESOLUTION_DELAYED" && ticket.delayReason && (
            <div className="mt-2 bg-amber-50 rounded-lg p-2">
              <p className="text-xs text-amber-700">
                <strong>Delay Reason:</strong> {ticket.delayReason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Section */}
      {isDeliveryDept && (
        <Card className="mb-3">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Delivery</p>
            <div className="space-y-1.5">
              {ticket.deliveryZone && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Zone</span>
                  <span className="text-xs font-medium text-slate-900">
                    {ticket.deliveryZone}
                  </span>
                </div>
              )}
              {ticket.deliveryAddress && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Address</span>
                  <span className="text-xs font-medium text-slate-900 text-right max-w-[60%]">
                    {ticket.deliveryAddress}
                  </span>
                </div>
              )}
              {ticket.estimatedDelivery && (
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Estimated</span>
                  <span className="text-xs font-medium text-slate-900">
                    {ticket.estimatedDelivery}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Reverse Pickup</span>
                <span className="text-xs font-medium text-slate-900">
                  {ticket.reversePickup ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline / Notes Section */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
            Timeline ({ticket.notes.length})
          </p>

          {ticket.notes.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No notes yet</p>
          ) : (
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
              {[...ticket.notes]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .map((note) => (
                  <div
                    key={note.id}
                    className="border-l-2 border-slate-200 pl-2.5 py-1"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge
                        variant={NOTE_TYPE_VARIANT[note.type] || "default"}
                        className="text-[9px] px-1.5 py-0"
                      >
                        {note.type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        {note.author?.name || "System"} | {timeAgo(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{note.content}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Add Note Input */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Add a note..."
              className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!noteText.trim() || sendingNote}
              className="bg-slate-900 text-white"
            >
              {sendingNote ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Action */}
      {isAdmin && (
        <div className="mb-6">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Delete Ticket
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 mb-2">
                Are you sure you want to delete ticket {ticket.ticketNo}? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-white text-slate-700 py-2 rounded-lg text-sm font-medium border border-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

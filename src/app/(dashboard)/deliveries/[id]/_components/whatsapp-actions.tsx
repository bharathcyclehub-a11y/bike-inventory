"use client";

import { MessageCircle, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryData } from "./types";

interface WhatsAppActionsProps {
  data: DeliveryData;
  deliveryId: string;
  templates: Record<string, string>;
  onSent: () => void;
}

function renderTemplate(template: string, vars: Record<string, string>) {
  let msg = template;
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
  }
  msg = msg.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), vars[key]) : "";
  });
  return msg.trim();
}

function openWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  const encodedMsg = encodeURIComponent(message);
  window.open(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodedMsg}`, "_blank");
}

export function WhatsAppActions({ data, deliveryId, templates, onSent }: WhatsAppActionsProps) {
  if (!data.customerPhone) return null;

  const getProductName = () => {
    if (!data.lineItems || data.lineItems.length === 0) return "your order";
    return data.lineItems.map((item) => item.name).join(", ");
  };

  const getLineItemsText = () => {
    if (!data.lineItems || data.lineItems.length === 0) return "";
    return data.lineItems.map((item) => `- ${item.name} (Qty: ${item.quantity})`).join("\n");
  };

  const markWhatsAppSent = async (field: "whatsAppScheduledSent" | "whatsAppDispatchedSent" | "whatsAppDeliveredSent") => {
    try {
      await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: true }),
      });
      onSent();
    } catch { /* silent */ }
  };

  const sendScheduledWhatsApp = () => {
    const date = data.scheduledDate ? new Date(data.scheduledDate).toLocaleDateString("en-IN") : "TBD";
    const productName = getProductName();
    let msg: string;
    if (templates.scheduled) {
      msg = renderTemplate(templates.scheduled, { customerName: data.customerName, productName, deliveryDate: date });
    } else if (data.isOutstation) {
      msg = `Hi ${data.customerName},\n\nYour order #${data.invoiceNo} has been shipped!\n\n${productName}\n\nYour package is on the way. We'll share tracking details once available.\n\nFor queries: 9876543210\n\nThank you!`;
    } else {
      msg = `Hi ${data.customerName},\n\nYour order #${data.invoiceNo} is out for delivery!\n\n${productName}\n\nOur delivery boy will call before arriving.\n\nFor queries: 9876543210\n\nThank you!`;
    }
    openWhatsApp(data.customerPhone!, msg);
    markWhatsAppSent("whatsAppScheduledSent");
  };

  const sendDispatchedWhatsApp = () => {
    const productName = getProductName();
    const lineItemsText = getLineItemsText();
    const accessories = data.freeAccessories || "None";
    const vNo = data.vehicleNo;
    const trackingLink = data.courierTrackingNo;

    const msg = templates.dispatched
      ? renderTemplate(templates.dispatched, {
          customerName: data.customerName,
          productName,
          vehicleNo: vNo || "",
          trackingLink: trackingLink || "",
          lineItems: lineItemsText,
          accessories,
        })
      : `Hello ${data.customerName},\n\nYour ${productName} is on the way!${vNo ? `\n\nVehicle No: ${vNo}` : ""}${trackingLink ? `\nTrack: ${trackingLink}` : ""}\n\nItems:\n${lineItemsText}\n\nFree Accessories:\n${accessories}\n\nThank you for choosing Bharath Cycle Hub!`;
    openWhatsApp(data.customerPhone!, msg);
    markWhatsAppSent("whatsAppDispatchedSent");
  };

  const sendDeliveredWhatsApp = () => {
    const reviewLink = data.googleReviewLink || "https://g.page/r/bharathcyclehub/review";
    let msg: string;
    if (templates.delivered) {
      msg = renderTemplate(templates.delivered, { customerName: data.customerName, reviewLink });
    } else if (data.isOutstation) {
      msg = `Hello ${data.customerName},\n\nYour order from Bharath Cycle Hub has been delivered!\n\nWe hope you enjoy your new cycle. If you have any issues with assembly or setup, please don't hesitate to reach out.\n\nWe'd love your feedback:\n${reviewLink}\n\nThank you for choosing Bharath Cycle Hub!\n- Team BCH`;
    } else {
      msg = `Hello ${data.customerName},\n\nThank you for your purchase from Bharath Cycle Hub!\n\nWe'd love to hear about your experience. Please leave us a review:\n${reviewLink}\n\nThank you!\n- Bharath Cycle Hub`;
    }
    openWhatsApp(data.customerPhone!, msg);
    markWhatsAppSent("whatsAppDeliveredSent");
  };

  const showScheduled = data.status === "SCHEDULED";
  const showDispatched = ["OUT_FOR_DELIVERY", "SHIPPED", "IN_TRANSIT"].includes(data.status);
  const showDelivered = data.status === "DELIVERED";

  if (!showScheduled && !showDispatched && !showDelivered) return null;

  return (
    <Card className="mb-3 border-green-200 bg-green-50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <p className="text-xs font-semibold text-green-900">WhatsApp Messages</p>
        </div>

        {/* Scheduled message */}
        {showScheduled && (
          data.whatsAppScheduledSent ? (
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs text-green-600">Scheduled msg sent</p>
            </div>
          ) : (
            <button
              onClick={sendScheduledWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Send Scheduled
            </button>
          )
        )}

        {/* Dispatched message */}
        {showDispatched && (
          data.whatsAppDispatchedSent ? (
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs text-green-600">Dispatched msg sent</p>
            </div>
          ) : (
            <button
              onClick={sendDispatchedWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Send Dispatched
            </button>
          )
        )}

        {/* Delivered message */}
        {showDelivered && (
          data.whatsAppDeliveredSent ? (
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <p className="text-xs text-green-600">Delivered msg sent</p>
            </div>
          ) : (
            <button
              onClick={sendDeliveredWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg text-xs font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Send Delivered
            </button>
          )
        )}
      </CardContent>
    </Card>
  );
}

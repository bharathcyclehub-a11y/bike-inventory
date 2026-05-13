"use client";

import { Phone, MapPin, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeliveryData } from "./types";

interface CustomerInfoCardProps {
  data: DeliveryData;
  onContactSaved: () => void;
  contactSaved: boolean;
}

export function CustomerInfoCard({ data, onContactSaved, contactSaved }: CustomerInfoCardProps) {
  const isOuts = data.isOutstation;

  const handleSaveContact = async () => {
    const phone = data.customerPhone!.replace(/\D/g, "").slice(-10);
    const contactName = `${data.customerName} - ${data.invoiceNo}`;
    const vcard = `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${contactName}\r\nTEL;TYPE=CELL:+91${phone}\r\nEND:VCARD`;
    const blob = new Blob([vcard], { type: "text/vcard" });
    const file = new File([blob], `${contactName}.vcf`, { type: "text/vcard" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Save Contact" });
        onContactSaved();
        return;
      } catch {
        // User cancelled share -- fall through to fallback
      }
    }

    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    onContactSaved();
  };

  return (
    <>
      {/* Customer Info Card */}
      <Card className={`mb-3 ${isOuts ? "border-amber-200" : ""}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{data.customerName}</p>
            {data.customerPhone && (
              <a href={`tel:${data.customerPhone}`} className="flex items-center gap-1 text-xs text-blue-600">
                <Phone className="h-3.5 w-3.5" /> {data.customerPhone}
              </a>
            )}
          </div>
          {data.alternatePhone && (
            <p className="text-xs text-slate-500">Alt: {data.alternatePhone}</p>
          )}
          {data.customerAddress && (
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600">{data.customerAddress}</p>
            </div>
          )}
          {(data.customerArea || data.customerPincode) && (
            <p className="text-xs text-slate-500">
              {data.customerArea ? `Area: ${data.customerArea}` : ""}
              {data.customerPincode ? ` | Pincode: ${data.customerPincode}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Contact prompt for PENDING */}
      {["PENDING"].includes(data.status) && data.customerPhone && !contactSaved && (
        <Card className="mb-3 border-blue-200 bg-blue-50">
          <CardContent className="p-3">
            <p className="text-xs text-blue-700 font-medium mb-1.5">Save the contact before proceeding</p>
            <button
              onClick={handleSaveContact}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Save Customer Contact
            </button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

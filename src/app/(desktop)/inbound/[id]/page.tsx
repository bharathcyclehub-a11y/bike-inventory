"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DesktopInboundDetailPage() {
  const params = useParams();
  return (
    <div>
      <Link href="/desktop/inbound" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Inbound
      </Link>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Shipment detail view coming soon</p>
        <p className="text-xs text-slate-400 mt-1">ID: {params.id}</p>
        <Link href={`/inbound/${params.id}`} className="text-blue-600 text-sm mt-3 inline-block hover:underline">
          Open in mobile view →
        </Link>
      </div>
    </div>
  );
}

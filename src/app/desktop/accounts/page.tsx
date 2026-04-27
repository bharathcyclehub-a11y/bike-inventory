"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

export default function DesktopAccountsPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-5 w-5 text-slate-700" />
        <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500">Accounts desktop view coming soon</p>
        <Link href="/accounts" className="text-blue-600 text-sm mt-3 inline-block hover:underline">
          Open in mobile view →
        </Link>
      </div>
    </div>
  );
}

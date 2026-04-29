import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") || "Contact";
  const phone = req.nextUrl.searchParams.get("phone") || "";

  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `TEL;TYPE=CELL:+91${cleanPhone}`,
    "END:VCARD",
  ].join("\r\n");

  return new NextResponse(vcard, {
    headers: {
      "Content-Type": "text/vcard",
      "Content-Disposition": `attachment; filename="${name.replace(/[^a-zA-Z0-9 ]/g, "")}.vcf"`,
    },
  });
}

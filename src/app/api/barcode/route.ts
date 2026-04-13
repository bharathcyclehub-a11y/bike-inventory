import { NextRequest, NextResponse } from "next/server";
import { generateBarcodePng } from "@/lib/barcode";
import type { BarcodeType } from "@/lib/barcode";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, type = "code128" } = body as {
      text: string;
      type?: BarcodeType;
    };

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const image = await generateBarcodePng({
      text,
      type,
      scale: type === "qrcode" ? 5 : 3,
      height: type === "qrcode" ? 5 : 12,
    });

    return NextResponse.json({ image, text, type });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Barcode generation failed" },
      { status: 500 }
    );
  }
}

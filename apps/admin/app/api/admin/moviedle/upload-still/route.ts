import { NextResponse } from "next/server";

import { getMoviedleSupabaseAdmin } from "@/lib/supabase/moviedle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
    const filePath = `stills/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

    const supabase = getMoviedleSupabaseAdmin();
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("moviedle-stills")
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from("moviedle-stills").getPublicUrl(filePath);
    const url = data?.publicUrl;
    if (!url) {
      throw new Error("Could not resolve public URL");
    }

    return NextResponse.json({ url, path: filePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload still";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

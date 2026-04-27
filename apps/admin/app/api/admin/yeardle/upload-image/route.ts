import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const getSupabaseYeardleAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "yeardle",
    },
  });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const mime = String(file.type || "").toLowerCase();
    const allowedMimes = new Set(["image/jpeg", "image/jpg", "image/png"]);
    if (!allowedMimes.has(mime)) {
      return NextResponse.json({ error: "Only JPG and PNG files are supported." }, { status: 400 });
    }

    const ext = mime.includes("png") ? "png" : "jpg";
    const filePath = `events/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const supabase = getSupabaseYeardleAdmin();
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("yeardle-events")
      .upload(filePath, bytes, {
        contentType: mime,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from("yeardle-events").getPublicUrl(filePath);
    const url = data?.publicUrl;
    if (!url) {
      throw new Error("Could not resolve public URL");
    }

    return NextResponse.json({ url, path: filePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseServerKey, getSupabaseUrl } from "@/lib/supabase/env";

export const runtime = "nodejs";

const getSupabaseAgegapleAdmin = () =>
  createClient(getSupabaseUrl(), getSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "agegaple",
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
    const allowedMimes = new Set(["image/jpeg", "image/jpg", "image/png", "image/avif"]);
    if (!allowedMimes.has(mime)) {
      return NextResponse.json({ error: "Only JPG, PNG, and AVIF files are supported." }, { status: 400 });
    }

    const ext = mime.includes("png") ? "png" : mime.includes("avif") ? "avif" : "jpg";
    const filePath = `couples/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const supabase = getSupabaseAgegapleAdmin();
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("agegaple-images")
      .upload(filePath, bytes, {
        contentType: mime,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from("agegaple-images").getPublicUrl(filePath);
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

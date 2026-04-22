import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate size: max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }

    // Validate type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPEG, PNG, WEBP, GIF." }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // If no Cloudinary configured → convert to base64 data URL as fallback
    if (!cloudName || !apiKey || !apiSecret) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;
      return NextResponse.json({
        url: dataUrl,
        publicId: `local_${Date.now()}`,
        mode: "local_fallback",
        warning: "Cloudinary not configured. Image stored as base64 locally.",
      });
    }

    // Cloudinary upload via REST API (no SDK needed)
    const timestamp = Math.round(Date.now() / 1000);
    const folder = "managerorder/proof";

    // Sign the upload
    const crypto = await import("node:crypto");
    const sigString = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(sigString).digest("hex");

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("api_key", apiKey);
    uploadForm.append("timestamp", String(timestamp));
    uploadForm.append("signature", signature);
    uploadForm.append("folder", folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Cloudinary error: ${err}` }, { status: 502 });
    }

    const result = await res.json() as { secure_url: string; public_id: string };

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      mode: "cloudinary",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}

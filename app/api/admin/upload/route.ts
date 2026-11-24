import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const bucket = "product-images";
const maxBytes = 4 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function ensureBucket() {
  const admin = createSupabaseAdminClient();
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(error.message);
  if (!buckets?.some((item) => item.name === bucket)) {
    const { error: createError } = await admin.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: maxBytes,
      allowedMimeTypes: [...allowedTypes.keys()],
    });
    if (createError && !/already exists/i.test(createError.message)) throw new Error(createError.message);
  }
  return admin;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can upload product photos." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The photos could not be read. Use JPG, PNG, or WebP files under 4MB." }, { status: 400 });
  }

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length < 1 || files.length > 3) {
    return NextResponse.json({ error: "Upload 2 or 3 product photos." }, { status: 400 });
  }

  let admin;
  try {
    admin = await ensureBucket();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo storage is not ready." }, { status: 500 });
  }

  const urls: string[] = [];
  for (const file of files) {
    const extension = allowedTypes.get(file.type);
    if (!extension) {
      return NextResponse.json({ error: "Use JPG, PNG, or WebP photos." }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Each photo must be under 4MB." }, { status: 400 });
    }
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error } = await admin.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    urls.push(admin.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  }

  return NextResponse.json({ urls });
}

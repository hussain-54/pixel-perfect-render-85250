/**
 * Private on-disk blob store for demo/local document objects.
 * Files live under .data/student-documents and are never served statically.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { STUDENT_DOCUMENTS_BUCKET } from "@/lib/document-storage";

const ROOT = path.join(process.cwd(), ".data", STUDENT_DOCUMENTS_BUCKET);

function assertSafeRelativePath(storagePath: string) {
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid storage path.");
  }
  return normalized;
}

export async function writePrivateDocumentBlob(
  storagePath: string,
  bytes: Buffer,
): Promise<{ storageBucket: string; storagePath: string; sha256: string }> {
  const relative = assertSafeRelativePath(storagePath);
  const full = path.join(ROOT, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" }).catch(async (err: NodeJS.ErrnoException) => {
    if (err.code === "EEXIST") {
      // Idempotent overwrite for the same version path is not allowed; caller must bump version.
      throw new Error("A file already exists at this private storage path.");
    }
    throw err;
  });
  return {
    storageBucket: STUDENT_DOCUMENTS_BUCKET,
    storagePath: relative,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readPrivateDocumentBlob(storagePath: string): Promise<Buffer | null> {
  const relative = assertSafeRelativePath(storagePath);
  const full = path.join(ROOT, relative);
  try {
    await access(full);
    return await readFile(full);
  } catch {
    return null;
  }
}

export function newPreviewToken(): string {
  return randomBytes(24).toString("base64url");
}
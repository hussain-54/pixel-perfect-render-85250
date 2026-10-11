import { useEffect, useState } from "react";
import { ErrorState, LoadingRows, portalErrorMessage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { fetchDocumentPreview, issueDocumentPreview } from "@/services";

/**
 * Authorized short-lived preview. Never uses a permanent public object URL.
 * Prefers a Supabase signed URL when issued; otherwise loads bytes via an auth-checked token.
 */
export function DocumentSecurePreview({
  documentId,
  fileName,
  hasPrivateFile,
}: {
  documentId: string;
  fileName: string;
  hasPrivateFile: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    setError(null);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    setMimeType(null);
    setExpiresAt(null);
    if (!hasPrivateFile) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const issued = await issueDocumentPreview(documentId);
        if (cancelled) return;
        setExpiresAt(issued.expiresAt);
        setMimeType(issued.mimeType);

        if (issued.signedUrl) {
          setObjectUrl(issued.signedUrl);
          return;
        }

        const payload = await fetchDocumentPreview(issued.token);
        if (cancelled) return;
        const binary = atob(payload.contentBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: payload.mimeType });
        setObjectUrl(URL.createObjectURL(blob));
        setMimeType(payload.mimeType);
        setExpiresAt(payload.expiresAt);
      } catch (err) {
        if (!cancelled) setError(portalErrorMessage(err, "Secure preview unavailable."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, hasPrivateFile, refreshKey]);

  if (!hasPrivateFile) {
    return (
      <div className="flex h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-4 text-center">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Private document preview
        </p>
        <p className="mt-2 text-sm font-semibold text-navy">{fileName}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          No private file object is stored for this record. Preview appears only after an authorized
          upload into private storage.
        </p>
      </div>
    );
  }

  if (loading) return <LoadingRows rows={3} />;
  if (error) {
    return (
      <div className="space-y-2">
        <ErrorState body={error} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null);
            setRefreshKey((k) => k + 1);
          }}
        >
          Retry secure preview
        </Button>
      </div>
    );
  }

  if (!objectUrl) return null;

  const isImage = (mimeType ?? "").startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
        {isImage ? (
          <img src={objectUrl} alt={fileName} className="max-h-72 w-full object-contain bg-white" />
        ) : isPdf ? (
          <iframe title={fileName} src={objectUrl} className="h-72 w-full bg-white" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-semibold text-navy">{fileName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Inline preview is not available for this file type. Use the authorized download link.
            </p>
            <a
              href={objectUrl}
              download={fileName}
              className="mt-3 text-sm font-semibold text-royal hover:underline"
            >
              Download via signed access
            </a>
          </div>
        )}
      </div>
      {expiresAt ? (
        <p className="text-xs text-muted-foreground">
          Access expires {new Date(expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
          Path metadata only — no public document URL.
        </p>
      ) : null}
    </div>
  );
}
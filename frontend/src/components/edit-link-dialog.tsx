import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/field-error";
import { getApiErrorMessage, type UserLink, updateLinkRequest } from "@/lib/api";
import { editLinkFormSchema, fieldErrorsFromZod } from "@/lib/validation";

type EditLinkDialogProps = {
  link: UserLink;
  trigger: ReactNode;
  onUpdated: (updatedLink: UserLink) => void;
};

export const EditLinkDialog = ({ link, trigger, onUpdated }: EditLinkDialogProps) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(link.url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | undefined>();
  const submittingRef = useRef(false);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      submittingRef.current = false;
      return;
    }

    setUrl(link.url);
    setError(null);
    setUrlError(undefined);
  }, [open, link.url]);

  const hasChanged = useMemo(() => url.trim() !== link.url, [url, link.url]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    const parsed = editLinkFormSchema.safeParse({ url });
    const nextUrlError = parsed.success ? undefined : fieldErrorsFromZod(parsed.error).url;
    setUrlError(nextUrlError);
    setError(null);
    if (!parsed.success) {
      urlRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await updateLinkRequest(link.slug, parsed.data.url);
      onUpdated(response.link);
      setOpen(false);
    } catch (updateError) {
      setError(getApiErrorMessage(updateError));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit link URL</DialogTitle>
          <DialogDescription>Update destination URL for /{link.slug}.</DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSave} noValidate>
          <div className="space-y-1.5">
            <label htmlFor={`edit-link-url-${link.id}`} className="text-sm font-medium">
              Destination URL
            </label>
            <Input
              ref={urlRef}
              id={`edit-link-url-${link.id}`}
              type="url"
              name="url"
              autoComplete="url"
              placeholder="https://example.com/new-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (urlError) {
                  const next = editLinkFormSchema.safeParse({ url: event.target.value });
                  setUrlError(next.success ? undefined : fieldErrorsFromZod(next.error).url);
                }
              }}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? `edit-link-url-error-${link.id}` : undefined}
            />
            <FieldError id={`edit-link-url-error-${link.id}`} message={urlError} />
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

          <DialogFooter className="mx-0 mb-0 rounded-none border-none bg-transparent p-0 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanged}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { createLinkRequest, getApiErrorMessage, getShortUrl, type UserLink } from "@/lib/api";
import { createLinkFormSchema, fieldErrorsFromZod, firstError } from "@/lib/validation";

type AddLinkDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (newLink: UserLink) => void;
};

type FieldErrors = {
  url?: string;
  slug?: string;
};

export const AddLinkDialog = ({ trigger, open, onOpenChange, onCreated }: AddLinkDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [createdLink, setCreatedLink] = useState<UserLink | null>(null);
  const submittingRef = useRef(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  const isControlled = useMemo(() => typeof open === "boolean", [open]);
  const dialogOpen = isControlled ? open : internalOpen;

  const shortUrl = useMemo(() => {
    if (!createdLink) {
      return "";
    }

    return getShortUrl(createdLink.slug);
  }, [createdLink]);

  const resetState = () => {
    setInputUrl("");
    setCustomSlug("");
    setError(null);
    setFieldErrors({});
    setIsSubmitting(false);
    setCreatedLink(null);
    submittingRef.current = false;
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }

    if (isControlled) {
      onOpenChange?.(nextOpen);
      return;
    }
    setInternalOpen(nextOpen);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    const parsed = createLinkFormSchema.safeParse({ url: inputUrl, slug: customSlug });
    const nextErrors = parsed.success ? {} : fieldErrorsFromZod(parsed.error);
    setFieldErrors(nextErrors);
    setError(null);

    if (!parsed.success) {
      const key = firstError(nextErrors, ["url", "slug"]);
      if (key === "url") {
        urlRef.current?.focus();
      } else if (key === "slug") {
        slugRef.current?.focus();
      }
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await createLinkRequest(parsed.data.url, parsed.data.slug);
      setCreatedLink(response.link);
      onCreated?.(response.link);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="sm:max-w-md">
        {!createdLink ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-semibold">Add a new link</DialogTitle>
              <DialogDescription>Paste your URL and create a short link instantly.</DialogDescription>
            </DialogHeader>

            <form className="space-y-3" onSubmit={handleCreate} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="new-link-url" className="text-sm font-medium">
                  Destination URL
                </label>
                <Input
                  ref={urlRef}
                  id="new-link-url"
                  type="url"
                  name="url"
                  autoComplete="url"
                  placeholder="https://example.com/some/long/path"
                  value={inputUrl}
                  onChange={(event) => {
                    setInputUrl(event.target.value);
                    if (fieldErrors.url || fieldErrors.slug) {
                      const next = createLinkFormSchema.safeParse({
                        url: event.target.value,
                        slug: customSlug,
                      });
                      setFieldErrors(next.success ? {} : fieldErrorsFromZod(next.error));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.url)}
                  aria-describedby={fieldErrors.url ? "new-link-url-error" : undefined}
                />
                <FieldError id="new-link-url-error" message={fieldErrors.url} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="new-link-slug" className="text-sm font-medium">
                  Custom slug <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  ref={slugRef}
                  id="new-link-slug"
                  type="text"
                  name="slug"
                  autoComplete="off"
                  placeholder="my-link"
                  value={customSlug}
                  onChange={(event) => {
                    setCustomSlug(event.target.value);
                    if (fieldErrors.url || fieldErrors.slug) {
                      const next = createLinkFormSchema.safeParse({
                        url: inputUrl,
                        slug: event.target.value,
                      });
                      setFieldErrors(next.success ? {} : fieldErrorsFromZod(next.error));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.slug)}
                  aria-describedby={fieldErrors.slug ? "new-link-slug-error" : undefined}
                />
                <FieldError id="new-link-slug-error" message={fieldErrors.slug} />
              </div>
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
              <DialogFooter className="mx-0 mb-0 rounded-none border-none bg-transparent p-0 sm:justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Congrats, your link has been shortened</DialogTitle>
              <DialogDescription>Your new short URL is ready.</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Short link</p>
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary underline underline-offset-4"
              >
                {shortUrl}
              </a>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-none border-none bg-transparent p-0 sm:justify-end">
              <Button type="button" onClick={() => setDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

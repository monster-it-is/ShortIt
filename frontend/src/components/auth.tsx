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
import { PasswordInput } from "@/components/password-input";
import { FieldError } from "@/components/field-error";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api";
import {
  fieldErrorsFromZod,
  firstError,
  loginFormSchema,
  PASSWORD_REQUIREMENTS_HINT,
  registerFormSchema,
} from "@/lib/validation";

type AuthDialogProps = {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

type Mode = "login" | "register";

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export const AuthDialog = ({ trigger, open, onOpenChange, onSuccess }: AuthDialogProps) => {
  const { isAuthenticated, login, register } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submittingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const isControlled = useMemo(() => typeof open === "boolean", [open]);
  const dialogOpen = isControlled ? open : internalOpen;

  const resetForm = () => {
    setError(null);
    setFieldErrors({});
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMode("login");
    submittingRef.current = false;
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (nextOpen && isAuthenticated) {
      onSuccess?.();
      return;
    }

    if (!nextOpen) {
      resetForm();
    }

    if (isControlled) {
      onOpenChange?.(nextOpen);
      return;
    }
    setInternalOpen(nextOpen);
  };

  const submitLabel = mode === "login" ? "Login" : "Create account";

  const parseAuthForm = () => {
    if (mode === "login") {
      return loginFormSchema.safeParse({ email, password });
    }

    return registerFormSchema.safeParse({ email, password, confirmPassword });
  };

  const fieldErrorsFromResult = (result: ReturnType<typeof parseAuthForm>): FieldErrors => {
    if (result.success) {
      return {};
    }

    return fieldErrorsFromZod(result.error);
  };

  const focusInvalid = (errors: FieldErrors) => {
    const key = firstError(errors, ["email", "password", "confirmPassword"]);
    if (key === "email") {
      emailRef.current?.focus();
    } else if (key === "password") {
      passwordRef.current?.focus();
    } else if (key === "confirmPassword") {
      confirmRef.current?.focus();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || isSubmitting) {
      return;
    }

    const parsed = parseAuthForm();
    const nextErrors = fieldErrorsFromResult(parsed);
    setFieldErrors(nextErrors);
    setError(null);

    if (!parsed.success) {
      focusInvalid(nextErrors);
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(parsed.data.email, parsed.data.password);
      } else {
        await register(parsed.data.email, parsed.data.password);
      }
      setDialogOpen(false);
      onSuccess?.();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setError(null);
    setFieldErrors({});
    setConfirmPassword("");
    setMode((prev) => (prev === "login" ? "register" : "login"));
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Welcome back" : "Create your account"}</DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Login to continue to your dashboard."
              : "Register and start managing your short links."}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              ref={emailRef}
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (fieldErrors.email || fieldErrors.password || fieldErrors.confirmPassword) {
                  const next = mode === "login"
                    ? loginFormSchema.safeParse({ email: event.target.value, password })
                    : registerFormSchema.safeParse({
                        email: event.target.value,
                        password,
                        confirmPassword,
                      });
                  setFieldErrors(fieldErrorsFromResult(next));
                }
              }}
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "auth-email-error" : undefined}
            />
            <FieldError id="auth-email-error" message={fieldErrors.email} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-sm font-medium">
              Password
            </label>
            <PasswordInput
              key={mode}
              ref={passwordRef}
              id="auth-password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "login" ? 1 : undefined}
              value={password}
              onChange={(event) => {
                const nextPassword = event.target.value;
                setPassword(nextPassword);
                if (fieldErrors.password || fieldErrors.confirmPassword || fieldErrors.email) {
                  const next = mode === "login"
                    ? loginFormSchema.safeParse({ email, password: nextPassword })
                    : registerFormSchema.safeParse({
                        email,
                        password: nextPassword,
                        confirmPassword,
                      });
                  setFieldErrors(fieldErrorsFromResult(next));
                }
              }}
              placeholder="Password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                [
                  fieldErrors.password ? "auth-password-error" : null,
                  mode === "register" ? "auth-password-hint" : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
            {mode === "register" ? (
              <p id="auth-password-hint" className="text-xs text-muted-foreground">
                {PASSWORD_REQUIREMENTS_HINT}
              </p>
            ) : null}
            <FieldError id="auth-password-error" message={fieldErrors.password} />
          </div>
          {mode === "register" ? (
            <div className="space-y-1.5">
              <label htmlFor="auth-confirm-password" className="text-sm font-medium">
                Confirm password
              </label>
              <PasswordInput
                ref={confirmRef}
                id="auth-confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  const nextConfirm = event.target.value;
                  setConfirmPassword(nextConfirm);
                  if (fieldErrors.confirmPassword || fieldErrors.password || fieldErrors.email) {
                    setFieldErrors(
                      fieldErrorsFromResult(
                        registerFormSchema.safeParse({
                          email,
                          password,
                          confirmPassword: nextConfirm,
                        })
                      )
                    );
                  }
                }}
                placeholder="Confirm password"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={fieldErrors.confirmPassword ? "auth-confirm-password-error" : undefined}
              />
              <FieldError id="auth-confirm-password-error" message={fieldErrors.confirmPassword} />
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

          <DialogFooter className="mx-0 mb-0 rounded-none border-none bg-transparent p-0 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="h-auto whitespace-normal text-left sm:justify-start"
              onClick={switchMode}
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

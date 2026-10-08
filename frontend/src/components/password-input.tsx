import { useRef, useState, type ComponentProps, type Ref } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

export const PasswordInput = ({ className, id, disabled, ref, ...props }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const innerRef = useRef<HTMLInputElement>(null);
  const label = visible ? "Hide password" : "Show password";

  const assignRef = (node: HTMLInputElement | null) => {
    innerRef.current = node;
    const forwarded = ref as Ref<HTMLInputElement> | undefined;
    if (typeof forwarded === "function") {
      forwarded(node);
    } else if (forwarded) {
      forwarded.current = node;
    }
  };

  const toggleVisibility = () => {
    const input = innerRef.current;
    const selectionStart = input?.selectionStart ?? null;
    const selectionEnd = input?.selectionEnd ?? null;

    setVisible((current) => !current);

    requestAnimationFrame(() => {
      if (!input) {
        return;
      }

      input.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  return (
    <div className="relative">
      <Input
        {...props}
        ref={assignRef}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={toggleVisibility}
        disabled={disabled}
        aria-label={label}
        aria-controls={id}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 inline-flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
};

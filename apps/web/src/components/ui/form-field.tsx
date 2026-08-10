import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const describedBy = [hint ? `${htmlFor}-hint` : "", error ? `${htmlFor}-error` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div data-describedby={describedBy || undefined}>{children}</div>
      {hint ? <p id={`${htmlFor}-hint`} className="form-field__hint">{hint}</p> : null}
      {error ? <p id={`${htmlFor}-error`} className="form-field__error" role="alert">{error}</p> : null}
    </div>
  );
}

"use client";

// Form primitives. The visual language is lifted straight from LoginForm.tsx —
// same rounded-xl inputs on `bg-ink`, same white/10 border going brand on
// focus, same red error strip — so the application form does not read as a
// second product bolted onto the first.

export function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-ink-surface/60 p-5 sm:p-6">
      <header className="mb-5 flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-[11px] font-black text-brand-light">
          {n}
        </span>
        <div>
          <h2 className="text-sm font-bold text-white">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  required = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold text-white/70"
      >
        {label}
        {required && <span className="ml-1 text-brand">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-ink px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-brand/50 disabled:cursor-not-allowed disabled:text-white/50";

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  disabled,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "url";
  autoComplete?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${INPUT_CLASS} ${invalid ? "border-red-500/50" : ""}`}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${INPUT_CLASS} resize-y leading-relaxed ${
        invalid ? "border-red-500/50" : ""
      }`}
    />
  );
}

// Chip-style radio / checkbox groups. Real <input> elements underneath a styled
// label, so keyboard navigation and screen readers get the native behaviour and
// the visual is purely CSS.
const CHIP_BASE =
  "cursor-pointer select-none rounded-xl border px-3.5 py-2 text-xs font-semibold transition";
const CHIP_ON = "border-brand/50 bg-brand/15 text-brand-light";
const CHIP_OFF =
  "border-white/10 bg-ink text-white/60 hover:border-white/25 hover:text-white";
const CHIP_DISABLED = "cursor-not-allowed opacity-60 hover:border-white/10";

export function RadioGroup<T extends string>({
  name,
  value,
  choices,
  onChange,
  disabled,
}: {
  name: string;
  value: T | "";
  choices: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const checked = value === choice.value;
        return (
          <label
            key={choice.value}
            className={`${CHIP_BASE} ${checked ? CHIP_ON : CHIP_OFF} ${
              disabled ? CHIP_DISABLED : ""
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(choice.value)}
            />
            {choice.label}
          </label>
        );
      })}
    </div>
  );
}

export function CheckboxGroup({
  name,
  values,
  choices,
  onChange,
  disabled,
}: {
  name: string;
  values: string[];
  choices: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (choice: string) => {
    onChange(
      values.includes(choice)
        ? values.filter((v) => v !== choice)
        : [...values, choice],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const checked = values.includes(choice);
        return (
          <label
            key={choice}
            className={`${CHIP_BASE} ${checked ? CHIP_ON : CHIP_OFF} ${
              disabled ? CHIP_DISABLED : ""
            }`}
          >
            <input
              type="checkbox"
              name={name}
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(choice)}
            />
            {choice}
          </label>
        );
      })}
    </div>
  );
}

// Tri-state yes/no. `null` is a real value here — it means the applicant has
// not answered — so this cannot be a plain checkbox.
export function YesNo({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      name={name}
      value={value === null ? "" : value ? "yes" : "no"}
      choices={[
        { value: "yes", label: "Тийм" },
        { value: "no", label: "Үгүй" },
      ]}
      onChange={(v) => onChange(v === "yes")}
      disabled={disabled}
    />
  );
}

import { useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Errors = { email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): Errors {
  const e: Errors = {};
  if (!EMAIL_RE.test(email.trim())) e.email = "Nhập email dạng ten@vidu.vn.";
  if (password.length < 8) e.password = "Mật khẩu có ít nhất 8 ký tự.";
  return e;
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="flex items-start gap-1 text-sm font-medium text-destructive">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Form đăng nhập: autocomplete đúng (username / current-password), lỗi gắn vào ô, focus về ô lỗi đầu tiên. */
export function FormDangNhap({ onSubmit }: { onSubmit?: (email: string, password: string) => Promise<void> }) {
  const id = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const email = emailRef.current?.value ?? "";
    const password = pwRef.current?.value ?? "";
    const e = validate(email, password);
    setErrors(e);
    if (e.email) return emailRef.current?.focus();
    if (e.password) return pwRef.current?.focus();
    setBusy(true);
    setServerError(false);
    try {
      await (onSubmit ?? (() => new Promise<void>((_, reject) => setTimeout(() => reject(new Error("401")), 900))))(email, password);
    } catch {
      setServerError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-[26rem] gap-5 rounded-lg">
      <CardHeader className="gap-2">
        <CardTitle>
          <h1 className="text-[length:var(--fs-2xl)]">Đăng nhập</h1>
        </CardTitle>
        <CardDescription className="text-base">Dùng email bạn đã đăng ký với Mạng nhà.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {serverError && (
          <div role="alert" className="flex gap-2 rounded-md bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 size-[18px] shrink-0" />
            <span>Email hoặc mật khẩu chưa đúng. Kiểm tra lại, hoặc đặt lại mật khẩu.</span>
          </div>
        )}
        <form noValidate onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input
              ref={emailRef}
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? `${id}-email-err` : undefined}
            />
            <FieldError id={`${id}-email-err`}>{errors.email}</FieldError>
          </div>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={`${id}-pw`}>Mật khẩu</Label>
              <a href="#" className="text-sm font-medium text-primary-text underline underline-offset-[3px]">Quên mật khẩu?</a>
            </div>
            <div className="relative">
              <Input
                ref={pwRef}
                id={`${id}-pw`}
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                className="pr-12"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? `${id}-pw-err` : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-0.5"
                aria-pressed={showPw}
                aria-controls={`${id}-pw`}
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                <span className="sr-only">{showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}</span>
              </Button>
            </div>
            <FieldError id={`${id}-pw-err`}>{errors.password}</FieldError>
          </div>
          <div className="flex min-h-10 items-center gap-2">
            <Checkbox id={`${id}-nho`} name="nho" className="size-5" />
            <Label htmlFor={`${id}-nho`} className="font-normal">Ghi nhớ trên máy này</Label>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> Đang đăng nhập…
              </>
            ) : (
              "Đăng nhập"
            )}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <a href="#" className="font-medium text-primary-text underline underline-offset-[3px]">Tạo tài khoản</a>
        </p>
      </CardContent>
    </Card>
  );
}

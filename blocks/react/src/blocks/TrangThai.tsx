import type { ReactNode } from "react";
import { AlertCircle, Inbox, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Kind = "rong" | "dang-tai" | "loi" | "khong-quyen";

interface Props {
  kind: Kind;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Mã lỗi kỹ thuật (chỉ cho kind="loi"), hiện dạng mono để người dùng chép gửi hỗ trợ. */
  code?: string;
  className?: string;
}

const ICON = { rong: Inbox, loi: AlertCircle, "khong-quyen": Lock } as const;

/** Một trong bốn trạng thái của vùng dữ liệu. Mỗi trạng thái nói chuyện gì đang xảy ra và làm gì tiếp. */
export function TrangThai({ kind, title, children, actions, code, className }: Props) {
  const box = cn("grid min-h-64 content-center justify-items-start gap-3 rounded-lg border bg-card px-5 py-6", className);
  if (kind === "dang-tai") {
    return (
      <section aria-busy="true" className={cn(box, "content-start justify-items-stretch gap-4")}>
        <h2 className="sr-only">{title ?? "Đang tải"}</h2>
        {[0, 1, 2].map((i) => (
          <div key={i} aria-hidden className="grid grid-cols-[2.5rem_1fr_4rem] items-center gap-3">
            <Skeleton className="size-10 rounded-full bg-muted motion-reduce:animate-none" />
            <div className="grid gap-2">
              <Skeleton className="h-3 bg-muted motion-reduce:animate-none" />
              <Skeleton className="h-3 w-3/5 bg-muted motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-3 bg-muted motion-reduce:animate-none" />
          </div>
        ))}
        <p role="status" className="text-sm text-muted-foreground">{children ?? "Đang tải…"}</p>
      </section>
    );
  }
  const Icon = ICON[kind];
  const headingId = `tt-${kind}`;
  return (
    <section aria-labelledby={headingId} className={box}>
      <Icon aria-hidden strokeWidth={1.75} className={cn("size-7 text-muted-foreground", kind === "loi" && "text-destructive")} />
      <h2 id={headingId} className="text-[length:var(--fs-md)] leading-[var(--lh-snug)] tracking-normal">{title}</h2>
      <div className="grid gap-3 text-muted-foreground [&_p]:m-0">{children}</div>
      {code && <code className="rounded-sm bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{code}</code>}
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/** Trang trình bày cả bốn trạng thái (dùng cho cổng kiểm và ảnh chụp). */
export function TrangThaiDemo() {
  const cap = "text-xs font-semibold text-muted-foreground";
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
      <figure className="m-0 grid grid-rows-[auto_1fr] gap-2">
        <figcaption className={cap}>Rỗng</figcaption>
        <TrangThai kind="rong" title="Chưa có thiết bị nào" actions={<><Button>Thêm thiết bị</Button><Button variant="outline">Quét mạng tự động</Button></>}>
          <p>Thêm thiết bị đầu tiên để bắt đầu theo dõi lưu lượng và cảnh báo.</p>
        </TrangThai>
      </figure>
      <figure className="m-0 grid grid-rows-[auto_1fr] gap-2">
        <figcaption className={cap}>Đang tải</figcaption>
        <TrangThai kind="dang-tai" title="Đang tải danh sách thiết bị">Đang tải danh sách thiết bị…</TrangThai>
      </figure>
      <figure className="m-0 grid grid-rows-[auto_1fr] gap-2">
        <figcaption className={cap}>Lỗi</figcaption>
        <TrangThai kind="loi" title="Không tải được danh sách thiết bị" code="ETIMEDOUT 192.168.1.1:443" actions={<><Button>Thử lại</Button><Button variant="ghost" asChild><a href="#">Xem nhật ký</a></Button></>}>
          <p>Bộ định tuyến không trả lời sau 10 giây. Kiểm tra bộ định tuyến còn bật và cùng mạng với máy này.</p>
        </TrangThai>
      </figure>
      <figure className="m-0 grid grid-rows-[auto_1fr] gap-2">
        <figcaption className={cap}>Không có quyền</figcaption>
        <TrangThai kind="khong-quyen" title="Bạn chưa có quyền xem mục này" actions={<Button variant="outline">Gửi yêu cầu cấp quyền</Button>}>
          <p>Danh sách thiết bị chỉ dành cho quản trị viên. Người quản trị hiện tại là Ngô Việt.</p>
        </TrangThai>
      </figure>
    </div>
  );
}

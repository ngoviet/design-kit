import { useId, useMemo, useState } from "react";
import { ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type TrangThaiTB = "Đang chạy" | "Chập chờn" | "Mất kết nối";
export interface ThietBi {
  ten: string;
  vitri: string;
  ip: string;
  trangThai: TrangThaiTB;
  xuong: number;
  len: number;
}

type Key = "ten" | "xuong" | "len";
const fmt = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const BADGE: Record<TrangThaiTB, string> = {
  "Đang chạy": "bg-[var(--ok-soft)] text-[var(--ok)]",
  "Chập chờn": "bg-[var(--warn-soft)] text-[var(--warn)]",
  "Mất kết nối": "bg-[var(--bad-soft)] text-[var(--bad)]",
};

function SortButton({ label, active, dir, onClick }: { label: string; active: boolean; dir: "ascending" | "descending"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex min-h-6 items-center gap-1 rounded-sm px-1 -mx-1 hover:bg-muted", active && "text-foreground")}>
      {label}
      <ChevronUp aria-hidden className={cn("size-3.5 opacity-45", active && "opacity-100", active && dir === "descending" && "rotate-180")} />
    </button>
  );
}

/** Bảng thiết bị: sắp xếp theo cột (aria-sort), số căn phải dùng chữ số cùng bề rộng, lọc theo chữ và trạng thái. */
export function BangDuLieu({ rows }: { rows: ThietBi[] }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"" | TrangThaiTB>("");
  const [sort, setSort] = useState<{ k: Key; dir: "ascending" | "descending" }>({ k: "ten", dir: "ascending" });
  const view = useMemo(() => {
    const s = sort.dir === "ascending" ? 1 : -1;
    return rows
      .filter((r) => (!q || `${r.ten} ${r.ip} ${r.vitri}`.toLowerCase().includes(q.toLowerCase())) && (!st || r.trangThai === st))
      .sort((a, b) => (sort.k === "ten" ? a.ten.localeCompare(b.ten, "vi") : a[sort.k] - b[sort.k]) * s);
  }, [rows, q, st, sort]);
  const toggle = (k: Key) => setSort((p) => ({ k, dir: p.k === k && p.dir === "ascending" ? "descending" : "ascending" }));
  const ariaSort = (k: Key) => (sort.k === k ? sort.dir : undefined);
  const clear = () => {
    setQ("");
    setSt("");
    document.getElementById(`${id}-q`)?.focus();
  };
  // Rỗng sau khi lọc: nói vì sao và đưa nút gỡ lọc, không để người dùng tự đoán (skill mục 2b).
  const empty = (
    <div className="grid justify-items-center gap-3 px-4 py-8 text-center">
      <p className="m-0 text-muted-foreground">Không có thiết bị nào khớp. Thử gõ ngắn hơn hoặc chọn trạng thái “Tất cả”.</p>
      <Button type="button" variant="outline" className="h-11" onClick={clear}>Xoá tìm kiếm và bộ lọc</Button>
    </div>
  );

  return (
    <section className="grid gap-4" aria-labelledby={`${id}-cap`}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[14rem] flex-1 gap-2">
          <Label htmlFor={`${id}-q`}>Tìm thiết bị</Label>
          <Input id={`${id}-q`} type="search" placeholder="Tên hoặc địa chỉ IP" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-st`}>Trạng thái</Label>
          <select id={`${id}-st`} value={st} onChange={(e) => setSt(e.target.value as "" | TrangThaiTB)} className="h-11 min-w-44 rounded-sm border border-input bg-card px-3 text-base">
            <option value="">Tất cả</option>
            <option>Đang chạy</option>
            <option>Chập chờn</option>
            <option>Mất kết nối</option>
          </select>
        </div>
        <p aria-live="polite" className="ml-auto text-sm leading-[2.75rem] text-muted-foreground">{view.length} thiết bị</p>
      </div>
      {/* Khung hẹp (< 40rem): mỗi thiết bị là một khối dọc có nhãn, không phải cuộn ngang trong bảng. */}
      <div className="@container">
      {/* Khung hẹp không có tiêu đề cột để bấm: sắp xếp đi qua ô chọn. */}
      <div className="mb-3 grid gap-2 @[40rem]:hidden">
        <Label htmlFor={`${id}-sx`}>Sắp xếp</Label>
        <select
          id={`${id}-sx`}
          value={`${sort.k}:${sort.dir}`}
          onChange={(e) => {
            const [k, dir] = e.target.value.split(":") as [Key, "ascending" | "descending"];
            setSort({ k, dir });
          }}
          className="h-11 rounded-sm border border-input bg-card px-3 text-base"
        >
          <option value="ten:ascending">Tên thiết bị (A → Z)</option>
          <option value="xuong:descending">Tải xuống (cao → thấp)</option>
          <option value="len:descending">Tải lên (cao → thấp)</option>
          {!["ten:ascending", "xuong:descending", "len:descending"].includes(`${sort.k}:${sort.dir}`) && (
            <option value={`${sort.k}:${sort.dir}`} disabled>Theo cột đang chọn</option>
          )}
        </select>
      </div>
      <ul className="m-0 grid list-none divide-y rounded-lg border bg-card p-0 @[40rem]:hidden" aria-label="Thiết bị đang theo dõi">
        {view.map((r) => (
          <li key={r.ip} className="grid gap-1 px-4 py-3 text-sm">
            <span className="font-semibold">{r.ten}</span>
            <span className="text-xs text-muted-foreground">{r.vitri}</span>
            <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Địa chỉ IP</dt><dd className="m-0 text-right font-mono tabular-nums">{r.ip}</dd>
              <dt className="text-muted-foreground">Trạng thái</dt><dd className="m-0 text-right"><Badge className={cn("border-0 font-semibold", BADGE[r.trangThai])}>{r.trangThai}</Badge></dd>
              <dt className="text-muted-foreground">Tải xuống</dt><dd className="m-0 text-right"><span className="font-mono tabular-nums">{fmt.format(r.xuong)}</span> Mb/s</dd>
              <dt className="text-muted-foreground">Tải lên</dt><dd className="m-0 text-right"><span className="font-mono tabular-nums">{fmt.format(r.len)}</span> Mb/s</dd>
            </dl>
          </li>
        ))}
        {view.length === 0 && <li>{empty}</li>}
      </ul>
      <div className="hidden overflow-hidden rounded-lg border bg-card @[40rem]:block">
        <Table className="text-sm">
          <TableCaption id={`${id}-cap`} className="caption-top px-4 pt-4 text-left text-base font-semibold text-foreground">Thiết bị đang theo dõi</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={ariaSort("ten")} className="px-4"><SortButton label="Thiết bị" active={sort.k === "ten"} dir={sort.dir} onClick={() => toggle("ten")} /></TableHead>
              <TableHead className="px-4">Địa chỉ IP</TableHead>
              <TableHead className="px-4">Trạng thái</TableHead>
              <TableHead aria-sort={ariaSort("xuong")} className="px-4 text-right"><SortButton label="Tải xuống" active={sort.k === "xuong"} dir={sort.dir} onClick={() => toggle("xuong")} /></TableHead>
              <TableHead aria-sort={ariaSort("len")} className="px-4 text-right"><SortButton label="Tải lên" active={sort.k === "len"} dir={sort.dir} onClick={() => toggle("len")} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.map((r) => (
              <TableRow key={r.ip}>
                <TableCell className="px-4 py-3"><span className="block font-semibold">{r.ten}</span><span className="block text-xs text-muted-foreground">{r.vitri}</span></TableCell>
                <TableCell className="px-4 font-mono tabular-nums">{r.ip}</TableCell>
                <TableCell className="px-4"><Badge className={cn("border-0 font-semibold", BADGE[r.trangThai])}>{r.trangThai}</Badge></TableCell>
                <TableCell className="px-4 text-right whitespace-nowrap"><span className="font-mono tabular-nums">{fmt.format(r.xuong)}</span> Mb/s</TableCell>
                <TableCell className="px-4 text-right whitespace-nowrap"><span className="font-mono tabular-nums">{fmt.format(r.len)}</span> Mb/s</TableCell>
              </TableRow>
            ))}
            {view.length === 0 && (
              <TableRow><TableCell colSpan={5} className="p-0">{empty}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      </div>
    </section>
  );
}

export const MAU_THIET_BI: ThietBi[] = [
  { ten: "Bộ định tuyến chính", vitri: "Phòng khách · cổng 1", ip: "192.168.1.1", trangThai: "Đang chạy", xuong: 182.4, len: 24.1 },
  { ten: "Switch tầng 2", vitri: "Phòng làm việc · cổng 3", ip: "192.168.1.12", trangThai: "Đang chạy", xuong: 96, len: 11.8 },
  { ten: "Camera cổng", vitri: "Sân trước · PoE", ip: "192.168.1.40", trangThai: "Chập chờn", xuong: 0.4, len: 6.2 },
  { ten: "NAS lưu trữ", vitri: "Phòng kho · cổng 5", ip: "192.168.1.20", trangThai: "Đang chạy", xuong: 41.7, len: 88.3 },
  { ten: "Điểm phát Wi‑Fi tầng 3", vitri: "Phòng ngủ · Mesh", ip: "192.168.1.31", trangThai: "Mất kết nối", xuong: 0, len: 0 },
];

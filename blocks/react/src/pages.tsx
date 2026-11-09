import { BangDuLieu, MAU_THIET_BI } from "./blocks/BangDuLieu";
import { FormDangNhap } from "./blocks/FormDangNhap";
import { HopThoaiXoa } from "./blocks/HopThoai";
import { TrangThaiDemo } from "./blocks/TrangThai";
import { mount } from "./mount";

const page = document.body.dataset.page;
if (page === "form-dang-nhap") {
  mount(
    <main className="grid min-h-dvh place-items-center px-4 py-6">
      <FormDangNhap />
    </main>,
  );
} else if (page === "trang-thai") {
  mount(
    <main className="mx-auto max-w-[72rem] px-4 pt-12 pb-16">
      <h1 className="mb-2 text-[length:var(--fs-2xl)]">Bốn trạng thái của một vùng dữ liệu</h1>
      <p className="mb-8 max-w-[var(--measure)] text-muted-foreground">
        Mỗi vùng hiện dữ liệu phải có đủ bốn trạng thái. Mỗi trạng thái nói rõ chuyện gì đang xảy ra và người dùng làm gì tiếp theo.
      </p>
      <TrangThaiDemo />
    </main>,
  );
}
if (page === "bang-du-lieu") {
  mount(
    <main className="mx-auto max-w-[72rem] px-4 pt-12 pb-16">
      <h1 className="mb-2 text-[length:var(--fs-2xl)]">Thiết bị trong mạng</h1>
      <p className="mb-8 max-w-[var(--measure)] text-muted-foreground">Bảng sắp xếp được theo cột. Cột số căn phải, dùng chữ số cùng bề rộng. Bộ lọc báo lại số kết quả cho trình đọc màn hình.</p>
      <BangDuLieu rows={MAU_THIET_BI} />
    </main>,
  );
} else if (page === "hop-thoai") {
  const open = new URLSearchParams(location.search).get("mo") === "1";
  mount(
    <main className="mx-auto max-w-[72rem] px-4 pt-12 pb-16">
      <h1 className="mb-2 text-[length:var(--fs-2xl)]">Hộp thoại xác nhận</h1>
      <p className="mb-8 max-w-[var(--measure)] text-muted-foreground">Dùng cho hành động khó hoàn tác. Hộp thoại nói rõ mất gì, và nút an toàn được focus trước.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-5 py-4">
        <div><strong className="block">Điểm phát Wi‑Fi tầng 3</strong><span className="text-sm text-muted-foreground">192.168.1.31 · mất kết nối từ 08:12</span></div>
        <HopThoaiXoa ten="Điểm phát Wi‑Fi tầng 3" mat={["Lịch sử lưu lượng 90 ngày", "4 quy tắc cảnh báo gắn với thiết bị"]} defaultOpen={open} />
      </div>
    </main>,
  );
}

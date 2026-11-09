import { FormDangNhap } from "./blocks/FormDangNhap";
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

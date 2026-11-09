import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Xác nhận hành động khó hoàn tác: nói rõ mất gì, nút an toàn ở trước (Radix focus nút Cancel đầu tiên),
 * nút nguy hiểm ghi đúng tên hành động.
 */
export function HopThoaiXoa({ ten, mat, onConfirm, defaultOpen }: { ten: string; mat: string[]; onConfirm?: () => void; defaultOpen?: boolean }) {
  return (
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Xoá thiết bị</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-lg bg-card p-5 sm:max-w-md sm:p-6">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-[length:var(--fs-lg)] leading-[var(--lh-tight)]">Xoá “{ten}”?</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Thiết bị sẽ biến mất khỏi danh sách theo dõi. Những thứ sau cũng bị xoá và không khôi phục được:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="m-0 grid list-disc gap-1 pl-5 text-muted-foreground">
          {mat.map((m) => <li key={m}>{m}</li>)}
        </ul>
        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel className="h-11">Giữ lại</AlertDialogCancel>
          <AlertDialogAction className="h-11 bg-destructive text-card hover:bg-destructive/90" onClick={onConfirm}>Xoá thiết bị</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

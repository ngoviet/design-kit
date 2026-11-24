/**
 * Phép đo `autoplay` và `permission` (mềm, 24/11/2026): trang tự phát tiếng hay tự xin quyền khi người dùng chưa chạm gì.
 *
 * Đo ý định chứ không đo tiếng phát ra. Trình duyệt của cổng chặn tự phát (thử trên Edge 24/11/2026: `play()` bị
 * NotAllowedError, `AudioContext` đứng ở `suspended`, `<audio autoplay>` vẫn dừng), nên đọc `paused` sau vài giây thì trang
 * sai và trang đúng giống hệt nhau; còn máy người dùng có thể cho phát.
 *
 * "Chưa chạm" = chưa có sự kiện chuột, phím, chạm nào `isTrusted`. Không dùng `navigator.userActivation`: `page.evaluate`
 * của Playwright chạy kèm userGesture, nên cờ đó thành true ngay ở câu hỏi đầu tiên của cổng.
 *
 * Nguồn: WCAG 1.4.2 (N12), MDN Autoplay (N66), Chrome autoplay policy (N88), Apple HIG Privacy (N44), MDN getUserMedia (N67).
 */
export interface OnloadCall {
  kind: "sound" | "permission";
  what: string;
  at: number;
}

/** Gắn bằng addInitScript trước khi trang chạy (mọi khung con cũng được gắn). Hàm tự chứa. */
export function installOnload(): void {
  interface Rec {
    gestured: boolean;
    calls: Array<{ kind: "sound" | "permission"; what: string; at: number }>;
  }
  const w = window as unknown as { __dkOnload?: Rec } & Record<string, unknown>;
  if (w.__dkOnload) return;
  const rec: Rec = { gestured: false, calls: [] };
  w.__dkOnload = rec;
  for (const t of ["pointerdown", "mousedown", "touchstart", "keydown"]) {
    addEventListener(t, (e) => {
      if (e.isTrusted) rec.gestured = true;
    }, { capture: true, passive: true });
  }
  const note = (kind: "sound" | "permission", what: string): void => {
    if (rec.gestured || rec.calls.length >= 40) return;
    if (!rec.calls.some((c) => c.kind === kind && c.what === what)) rec.calls.push({ kind, what, at: Math.round(performance.now()) });
  };
  const wrap = (obj: unknown, name: string, before: (self: unknown, args: unknown[]) => void): void => {
    const o = obj as Record<string, unknown> | undefined;
    const orig = o?.[name];
    if (!o || typeof orig !== "function") return;
    try {
      o[name] = function (this: unknown, ...args: unknown[]): unknown {
        try {
          before(this, args);
        } catch {
          /* phép đo không được làm hỏng trang */
        }
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      };
    } catch {
      /* thuộc tính không ghi được: bỏ qua */
    }
  };
  const g = globalThis as unknown as Record<string, { prototype: unknown } & Record<string, unknown>>;
  wrap(g["HTMLMediaElement"]?.prototype, "play", (self) => {
    const m = self as HTMLMediaElement;
    if (!m.muted && m.volume > 0) note("sound", `${m.tagName.toLowerCase()}${m.id ? `#${m.id}` : ""}.play()`);
  });
  // Nút nguồn của Web Audio chỉ kêu khi start(). Tạo sẵn AudioContext lúc nạp là chuyện thường, không tính. Bỏ qua
  // OfflineAudioContext (phân tích) và đệm ngắn dưới 50 ms (mẹo mở khoá tiếng trên iOS).
  const startOf = (self: unknown): void => {
    const n = self as AudioScheduledSourceNode & { buffer?: AudioBuffer | null };
    if (typeof OfflineAudioContext !== "undefined" && n.context instanceof OfflineAudioContext) return;
    if ("buffer" in n && (!n.buffer || n.buffer.duration < 0.05)) return;
    note("sound", `Web Audio ${n.constructor.name}.start()`);
  };
  wrap(g["AudioScheduledSourceNode"]?.prototype, "start", startOf);
  if (Object.prototype.hasOwnProperty.call(g["AudioBufferSourceNode"]?.prototype ?? {}, "start")) wrap(g["AudioBufferSourceNode"]!.prototype, "start", startOf);
  wrap(g["SpeechSynthesis"]?.prototype, "speak", () => note("sound", "speechSynthesis.speak()"));
  wrap(g["MediaDevices"]?.prototype, "getUserMedia", (_s, a) => {
    const c = (a[0] ?? {}) as { audio?: unknown; video?: unknown };
    note("permission", `getUserMedia(${[c.audio ? "microphone" : "", c.video ? "camera" : ""].filter(Boolean).join(" + ") || "media"})`);
  });
  for (const name of ["getUserMedia", "webkitGetUserMedia"]) wrap(g["Navigator"]?.prototype, name, () => note("permission", `navigator.${name}()`));
  wrap(g["Notification"], "requestPermission", () => note("permission", "Notification.requestPermission()"));
  wrap(g["PushManager"]?.prototype, "subscribe", () => note("permission", "pushManager.subscribe()"));
  wrap(g["Geolocation"]?.prototype, "getCurrentPosition", () => note("permission", "geolocation.getCurrentPosition()"));
  wrap(g["Geolocation"]?.prototype, "watchPosition", () => note("permission", "geolocation.watchPosition()"));
}

/** Đọc sổ của một khung, cộng các thẻ audio/video có `autoplay` mà không tắt tiếng (đi xuyên open shadow root). */
export function readOnload(): OnloadCall[] {
  const rec = (window as unknown as { __dkOnload?: { calls: OnloadCall[] } }).__dkOnload;
  const out: OnloadCall[] = rec ? [...rec.calls] : [];
  const walk = (root: Document | ShadowRoot): void => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (!(el instanceof HTMLMediaElement) || !el.autoplay || el.muted || el.volume === 0) continue;
      if (!el.currentSrc && !el.getAttribute("src") && !el.srcObject && !el.querySelector("source[src]")) continue;
      out.push({ kind: "sound", what: `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""} autoplay> without muted`, at: 0 });
    }
  };
  walk(document);
  return out;
}

/** Lời báo cho một mục trong sổ. */
export function onloadFinding(c: OnloadCall): { check: "autoplay" | "permission"; where: string; detail: string } {
  const when = c.at > 0 ? ` ${c.at} ms after load` : "";
  return c.kind === "sound"
    ? { check: "autoplay", where: c.what, detail: `sound starts by itself${when}, before any tap or key: start it from a button, or keep it muted` }
    : { check: "permission", where: c.what, detail: `permission asked${when}, before any tap or key: ask when the person presses the control that needs it, after saying why` };
}

"use client";

import { useEffect, useState } from "react";

function isBlockedShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === "f12") {
    return true;
  }

  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) {
    return false;
  }

  return (
    (event.shiftKey && ["i", "j", "c"].includes(key))
    || key === "u"
    || key === "s"
  );
}

export function PublicPageSecurityGuard() {
  const [inspectionDetected, setInspectionDetected] = useState(false);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setInspectionDetected(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isBlockedShortcut(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setInspectionDetected(true);
    };

    const detector = window.setInterval(() => {
      if (window.innerWidth < 1024) {
        return;
      }

      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      if (widthGap > 180 || heightGap > 180) {
        setInspectionDetected(true);
      }
    }, 1500);

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearInterval(detector);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  if (!inspectionDetected) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/96 px-6 text-center text-white backdrop-blur-md">
      <div className="max-w-md space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-200">
          Protected Session
        </p>
        <h2 className="text-2xl font-black tracking-tight">
          Nội dung này đang ở chế độ bảo vệ.
        </h2>
        <p className="text-sm leading-7 text-slate-300">
          Công cụ kiểm tra trình duyệt và các phím tắt xem mã đã bị chặn ở lớp client.
          Dữ liệu nhạy cảm vẫn được giữ ở server và không cấp trực tiếp cho trình duyệt.
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
export type Detail = { title: string; body: string };

export function DetailDialog({
  detail,
  onClose,
}: {
  detail: Detail | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!detail) return;
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [detail]);
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      aria-labelledby="detail-title"
      aria-describedby="detail-body"
      onClose={onClose}
    >
      <h2 id="detail-title">{detail?.title}</h2>
      <p id="detail-body">{detail?.body}</p>
      <Button variant="outline" onClick={() => dialog.current?.close()}>
        Close
      </Button>
    </dialog>
  );
}

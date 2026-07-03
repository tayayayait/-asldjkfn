import { useState } from "react";
import { Check, Download, Eye, RefreshCw, X } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IMAGE_STATUS_LABELS,
  type ImageGenerationWithRelations,
} from "@/lib/api/images";
import { cn } from "@/lib/utils";

type ImageGalleryProps = {
  images: ImageGenerationWithRelations[];
  selectedImageId?: string;
  onSelectImage: (image: ImageGenerationWithRelations) => void;
  onApprove: (image: ImageGenerationWithRelations) => void;
  onReject: (image: ImageGenerationWithRelations) => void;
  onRegenerate: (image: ImageGenerationWithRelations) => void;
  onExport: (image: ImageGenerationWithRelations) => void;
};

export function ImageGallery({
  images,
  selectedImageId,
  onSelectImage,
  onApprove,
  onReject,
  onRegenerate,
  onExport,
}: ImageGalleryProps) {
  const [preview, setPreview] = useState<ImageGenerationWithRelations | null>(
    null,
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {images.map((image) => (
          <article
            key={image.id}
            className={cn(
              "group overflow-hidden rounded-md border bg-card",
              selectedImageId === image.id ? "border-primary" : "border-border",
            )}
          >
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              <button
                type="button"
                className="absolute inset-0 block h-full w-full"
                onClick={() => onSelectImage(image)}
              >
                {image.thumbnailUrl || image.signedUrl ? (
                  <img
                    src={image.thumbnailUrl ?? image.signedUrl ?? undefined}
                    alt={image.concept}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                    이미지 없음
                  </div>
                )}
                <div className="absolute left-2 top-2">
                  <StatusBadge tone={statusTone(image.status)}>
                    {IMAGE_STATUS_LABELS[image.status]}
                  </StatusBadge>
                </div>
                <div className="absolute right-2 top-2">
                  <StatusBadge tone="muted">{image.aspect_ratio}</StatusBadge>
                </div>
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-full justify-center gap-1 bg-background/95 p-2 transition-transform group-hover:translate-y-0">
                <ActionButton label="미리보기" onClick={() => setPreview(image)}>
                  <Eye className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton label="승인" onClick={() => onApprove(image)}>
                  <Check className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton label="반려" onClick={() => onReject(image)}>
                  <X className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton label="재생성" onClick={() => onRegenerate(image)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </ActionButton>
                <ActionButton label="내보내기" onClick={() => onExport(image)}>
                  <Download className="h-3.5 w-3.5" />
                </ActionButton>
              </div>
            </div>
            <div className="space-y-1 p-2 text-xs">
              <div className="truncate font-medium">{image.concept}</div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="truncate">
                  {image.products?.name_ko ?? image.product_id}
                </span>
                <span>{formatDate(image.created_at)}</span>
              </div>
            </div>
          </article>
        ))}
        {images.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            생성된 이미지가 없습니다.
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{preview?.concept ?? "이미지 미리보기"}</DialogTitle>
          </DialogHeader>
          {preview?.signedUrl ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <img
                src={preview.signedUrl}
                alt={preview.concept}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
              <div className="space-y-3 text-sm">
                <Meta label="상태" value={IMAGE_STATUS_LABELS[preview.status]} />
                <Meta label="비율" value={preview.aspect_ratio} />
                <Meta label="배경" value={preview.background_tone ?? "-"} />
                <Meta label="품질점수" value={String(preview.quality_score ?? "-")} />
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">프롬프트</div>
                  <pre className="max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                    {preview.prompt_used ?? "-"}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      title={label}
      aria-label={label}
      size="icon"
      variant="ghost"
      className="pointer-events-auto h-8 w-8"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function statusTone(status: ImageGenerationWithRelations["status"]) {
  switch (status) {
    case "approved":
    case "exported":
      return "success";
    case "rejected":
    case "failed":
      return "danger";
    case "generated":
    case "ready":
      return "info";
    case "generating":
    case "review_pending":
    case "preprocessing":
      return "warning";
    default:
      return "muted";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

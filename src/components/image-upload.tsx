import { useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ProductAssetWithUrl } from "@/lib/api/images";
import { useUploadProductImage } from "@/hooks/use-images";
import { cn } from "@/lib/utils";

type ImageUploadProps = {
  productId?: string;
  assets: ProductAssetWithUrl[];
  selectedAssetId?: string;
  onSelectAsset: (assetId: string) => void;
  onUploaded?: (asset: ProductAssetWithUrl) => void;
};

export function ImageUpload({
  productId,
  assets,
  selectedAssetId,
  onSelectAsset,
  onUploaded,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const uploadImage = useUploadProductImage();

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];

    if (!file) {
      return;
    }

    if (!productId) {
      toast.error("제품을 먼저 선택해야 합니다.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("JPG, PNG, WebP 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      const dimensions = await readImageDimensions(file);
      const asset = await uploadImage.mutateAsync({
        productId,
        file,
        width: dimensions.width,
        height: dimensions.height,
        isPrimary: assets.length === 0,
      });
      onSelectAsset(asset.id);
      onUploaded?.(asset);
      toast.success("원본 이미지를 업로드했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={cn(
          "flex aspect-[4/3] w-full flex-col items-center justify-center rounded-md border-2 border-dashed bg-muted/30 px-4 text-center text-sm transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-border",
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
        <span className="font-medium">원본 이미지 업로드</span>
        <span className="mt-1 text-xs text-muted-foreground">
          JPG, PNG, WebP · 최대 10MB
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {uploadImage.isPending ? <Progress value={65} /> : null}

      <div className="space-y-2">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm",
              selectedAssetId === asset.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/30",
            )}
            onClick={() => onSelectAsset(asset.id)}
          >
            {asset.signedUrl ? (
              <img
                src={asset.signedUrl}
                alt={asset.file_name}
                className="h-14 w-14 rounded object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded bg-muted">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{asset.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {asset.width && asset.height
                  ? `${asset.width}x${asset.height}`
                  : "크기 정보 없음"}{" "}
                · {formatBytes(asset.file_size)}
              </div>
            </div>
            {asset.is_primary ? <StatusBadge tone="success">대표</StatusBadge> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number | null; height: number | null }>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

function formatBytes(value: number | null) {
  if (!value) {
    return "0 B";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

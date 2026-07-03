import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ImageGallery } from "@/components/image-gallery";
import { ImageUpload } from "@/components/image-upload";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  IMAGE_STATUS_LABELS,
  type ExportSizeKey,
  type ImageGenerationStatus,
  type ImageGenerationWithRelations,
} from "@/lib/api/images";
import {
  useApproveImage,
  useExportImage,
  useGenerateImage,
  useImageGenerations,
  useProductAssets,
  useRejectImage,
} from "@/hooks/use-images";
import { useProducts } from "@/hooks/use-products";

export const Route = createFileRoute("/images")({
  head: () => ({ meta: [{ title: "이미지 만들기 · 전통문화 RAG 어드민" }] }),
  component: ImagesPage,
});

const conceptOptions = [
  "궁중 선물 패키지",
  "공예 작업대",
  "박물관 쇼케이스",
  "프리미엄 썸네일",
  "SNS 라이프스타일",
];
const backgroundOptions = [
  "밝은 한지 질감",
  "중립 스튜디오",
  "고급스러운 어두운 배경",
  "자연광 테이블",
];
const preserveOptions = ["제품 형태", "제품 색상", "로고", "재질감"];
const excludeOptions = ["사람", "과도한 장식", "문자", "워터마크"];
const exportSizes: ExportSizeKey[] = [
  "instagram_square",
  "instagram_portrait",
  "instagram_story",
  "wide",
];

function ImagesPage() {
  const productsQuery = useProducts({ pageSize: 100 });
  const products = productsQuery.data?.data ?? [];
  const [productId, setProductId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [selectedImageId, setSelectedImageId] = useState<string | undefined>();
  const [concept, setConcept] = useState(conceptOptions[0]);
  const [backgroundTone, setBackgroundTone] = useState(backgroundOptions[0]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [status, setStatus] = useState<ImageGenerationStatus | "all">("all");
  const [preserveRules, setPreserveRules] = useState<string[]>([
    "제품 형태",
    "제품 색상",
  ]);
  const [excludeElements, setExcludeElements] = useState<string[]>([
    "문자",
    "워터마크",
  ]);
  const [customPrompt, setCustomPrompt] = useState("");

  const assetsQuery = useProductAssets(productId);
  const imagesQuery = useImageGenerations({
    productId: productId || "all",
    status,
    pageSize: 32,
  });
  const generateImage = useGenerateImage();
  const approveImage = useApproveImage();
  const rejectImage = useRejectImage();
  const exportImage = useExportImage();
  const assets = assetsQuery.data ?? [];
  const images = imagesQuery.data?.data ?? [];

  useEffect(() => {
    if (!productId && products[0]) {
      setProductId(products[0].id);
    }
  }, [productId, products]);

  useEffect(() => {
    if (!selectedAssetId && assets[0]) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  async function handleGenerate() {
    if (!productId) {
      toast.error("제품을 먼저 선택해야 합니다.");
      return;
    }

    try {
      const image = await generateImage.mutateAsync({
        productId,
        originalAssetId: selectedAssetId,
        concept,
        backgroundTone,
        aspectRatio,
        preserveRules,
        excludeElements,
        customPrompt,
      });
      setSelectedImageId(image.id);
      toast.success("이미지를 생성했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleApprove(image: ImageGenerationWithRelations) {
    try {
      await approveImage.mutateAsync({ id: image.id });
      toast.success("이미지를 승인했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleReject(image: ImageGenerationWithRelations) {
    const note = window.prompt("반려 사유를 입력하세요.");

    if (!note?.trim()) {
      toast.error("반려 사유가 필요합니다.");
      return;
    }

    try {
      await rejectImage.mutateAsync({ id: image.id, note });
      toast.success("이미지를 반려했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExport(image: ImageGenerationWithRelations) {
    try {
      const result = await exportImage.mutateAsync({
        id: image.id,
        sizes: exportSizes,
      });
      const fileCount =
        typeof result === "object" &&
        result &&
        "data" in result &&
        Array.isArray((result as { data?: { files?: unknown[] } }).data?.files)
          ? (result as { data: { files: unknown[] } }).data.files.length
          : exportSizes.length;
      toast.success(`SNS 규격 ${fileCount}개를 내보냈습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRegenerate(image: ImageGenerationWithRelations) {
    setConcept(image.concept);
    setBackgroundTone(image.background_tone ?? backgroundTone);
    setAspectRatio(image.aspect_ratio);
    setPreserveRules(image.preserve_rules);
    setExcludeElements(image.exclude_elements);
    setSelectedAssetId(image.original_asset_id ?? selectedAssetId);

    try {
      const regenerated = await generateImage.mutateAsync({
        productId: image.product_id,
        originalAssetId: image.original_asset_id ?? undefined,
        concept: image.concept,
        backgroundTone: image.background_tone ?? backgroundTone,
        aspectRatio: image.aspect_ratio,
        preserveRules: image.preserve_rules,
        excludeElements: image.exclude_elements,
        customPrompt,
      });
      setSelectedImageId(regenerated.id);
      toast.success("이미지를 재생성했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="이미지 만들기"
        description="원본 상품 사진을 올리고 전통문화 콘셉트의 연출 이미지를 만듭니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => imagesQuery.refetch()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 새로고침
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 p-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">제품 및 원본</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="제품">
                <Select value={productId || "none"} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <SelectItem value="none" disabled>
                        제품 없음
                      </SelectItem>
                    ) : null}
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name_ko}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <ImageUpload
                productId={productId}
                assets={assets}
                selectedAssetId={selectedAssetId}
                onSelectAsset={setSelectedAssetId}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">생성 결과 갤러리</CardTitle>
            <div className="flex items-center gap-2">
              <StatusBadge tone="muted">{imagesQuery.data?.count ?? 0}개</StatusBadge>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as ImageGenerationStatus | "all")
                }
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  {Object.entries(IMAGE_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ImageGallery
              images={images}
              selectedImageId={selectedImageId}
              onSelectImage={(image) => setSelectedImageId(image.id)}
              onApprove={(image) => void handleApprove(image)}
              onReject={(image) => void handleReject(image)}
              onRegenerate={(image) => void handleRegenerate(image)}
              onExport={(image) => void handleExport(image)}
            />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">생성 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="콘셉트">
              <Select value={concept} onValueChange={setConcept}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conceptOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="배경 톤">
              <Select value={backgroundTone} onValueChange={setBackgroundTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {backgroundOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="비율">
              <RadioGroup
                className="grid grid-cols-4 gap-2"
                value={aspectRatio}
                onValueChange={setAspectRatio}
              >
                {["1:1", "4:5", "9:16", "16:9"].map((ratio) => (
                  <label
                    key={ratio}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-xs"
                  >
                    <RadioGroupItem value={ratio} />
                    {ratio}
                  </label>
                ))}
              </RadioGroup>
            </Field>

            <CheckboxGroup
              label="유지 규칙"
              options={preserveOptions}
              values={preserveRules}
              onChange={setPreserveRules}
            />
            <CheckboxGroup
              label="제외 요소"
              options={excludeOptions}
              values={excludeElements}
              onChange={setExcludeElements}
            />

            <Field label="추가 프롬프트">
              <Textarea
                className="min-h-24"
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
                placeholder="조명, 질감, 구도 등 추가 지시"
              />
            </Field>

            <Button
              className="w-full"
              disabled={generateImage.isPending}
              onClick={handleGenerate}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {generateImage.isPending ? "생성 중" : "이미지 만들기"}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              disabled={!selectedImageId}
              onClick={() => {
                const image = images.find((item) => item.id === selectedImageId);

                if (image) {
                  void handleExport(image);
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" /> SNS 규격 내보내기
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const checked = values.includes(option);

          return (
            <label
              key={option}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-2 text-xs"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  onChange(
                    next
                      ? Array.from(new Set([...values, option]))
                      : values.filter((value) => value !== option),
                  );
                }}
              />
              {option}
            </label>
          );
        })}
      </div>
    </div>
  );
}

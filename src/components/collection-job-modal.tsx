import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  COLLECTION_SOURCE_TYPE_LABELS,
  type CollectionSourceType,
  type CreateCollectionJobParams,
} from "@/lib/api/sources";

type CollectionTargetMode = "selected" | "all";

type CollectionJobModalProps = {
  open: boolean;
  selectedCount: number;
  selectedProductIds?: string[];
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (params: CreateCollectionJobParams) => Promise<void> | void;
};

const collectionSourceTypes = Object.keys(
  COLLECTION_SOURCE_TYPE_LABELS,
) as CollectionSourceType[];

export function CollectionJobModal({
  open,
  selectedCount,
  selectedProductIds = [],
  isSubmitting = false,
  onOpenChange,
  onStart,
}: CollectionJobModalProps) {
  const [targetMode, setTargetMode] = useState<CollectionTargetMode>("all");
  const [sourceTypes, setSourceTypes] = useState<CollectionSourceType[]>([
    "own_mall",
    "naver_web",
    "naver_blog",
    "naver_news",
  ]);
  const [limitPerSource, setLimitPerSource] = useState(10);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      setTargetMode(selectedCount > 0 ? "selected" : "all");
    }
  }, [open, selectedCount]);

  const estimatedLabel = useMemo(() => {
    if (targetMode === "all") {
      return `전체 활성 제품 x 출처 ${sourceTypes.length}개 x 최대 ${limitPerSource}건`;
    }

    return `선택 제품 ${selectedCount}개 x 출처 ${sourceTypes.length}개 x 최대 ${limitPerSource}건`;
  }, [limitPerSource, selectedCount, sourceTypes.length, targetMode]);

  const canSubmit =
    sourceTypes.length > 0 && (targetMode === "all" || selectedCount > 0);

  const toggleSourceType = (sourceType: CollectionSourceType) => {
    setSourceTypes((current) =>
      current.includes(sourceType)
        ? current.filter((item) => item !== sourceType)
        : [...current, sourceType],
    );
  };

  const handleStart = async () => {
    if (!canSubmit) {
      return;
    }

    await onStart({
      productIds: targetMode === "selected" ? selectedProductIds : undefined,
      sourceTypes,
      limitPerSource,
      query: query.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>수집 작업 생성</DialogTitle>
          <DialogDescription>
            제품별 자사몰 URL과 Naver 검색 결과를 원문 후보로 등록하고, 각 URL의
            크롤링 작업을 큐에 넣습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-2">
            <Label>대상 제품</Label>
            <RadioGroup
              value={targetMode}
              onValueChange={(value) =>
                setTargetMode(value as CollectionTargetMode)
              }
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
                <RadioGroupItem
                  value="selected"
                  disabled={selectedCount === 0}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">선택 제품</span>
                  <span className="text-xs text-muted-foreground">
                    현재 선택된 제품 {selectedCount}개만 수집합니다.
                  </span>
                </span>
              </label>
              <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
                <RadioGroupItem value="all" className="mt-0.5" />
                <span>
                  <span className="block font-medium">전체 활성 제품</span>
                  <span className="text-xs text-muted-foreground">
                    보관 상태가 아닌 전체 제품을 대상으로 합니다.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </section>

          <section className="grid gap-2">
            <Label>출처 유형</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {collectionSourceTypes.map((sourceType) => (
                <label
                  key={sourceType}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={sourceTypes.includes(sourceType)}
                    onCheckedChange={() => toggleSourceType(sourceType)}
                  />
                  <span>{COLLECTION_SOURCE_TYPE_LABELS[sourceType]}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>출처별 최대 URL 수</Label>
              <span className="font-mono text-sm text-muted-foreground">
                {limitPerSource}
              </span>
            </div>
            <Slider
              min={5}
              max={20}
              step={1}
              value={[limitPerSource]}
              onValueChange={([value]) => setLimitPerSource(value ?? 10)}
            />
            <p className="text-xs text-muted-foreground">{estimatedLabel}</p>
          </section>

          <section className="grid gap-2">
            <Label htmlFor="collection-query">추가 검색어</Label>
            <Input
              id="collection-query"
              value={query}
              placeholder="예: 무형문화재, 공예 기법, 문양 의미"
              onChange={(event) => setQuery(event.target.value)}
            />
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
          <Button disabled={!canSubmit || isSubmitting} onClick={handleStart}>
            <Play className="mr-2 h-4 w-4" />
            작업 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/hooks/use-products";
import {
  useAddManualSource,
  useApproveSource,
  useApproveSourceWithEdit,
  useCrawlSourceDocument,
  useMarkSourceDuplicate,
  useRejectSource,
  useSourceDocument,
  useSourceDocuments,
} from "@/hooks/use-sources";
import {
  getNextPendingSourceId,
  SOURCE_STATUS_LABELS,
  SOURCE_TYPE_LABELS,
  type SourceDocument,
  type SourceDocumentStatus,
  type SourceDocumentType,
} from "@/lib/api/sources";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [{ title: "자료 확인 · 전통문화 RAG 어드민" }],
  }),
  component: SourcesPage,
});

const sourceStatuses: Array<SourceDocumentStatus | "all"> = [
  "all",
  "review_pending",
  "queued",
  "fetching",
  "fetched",
  "parse_failed",
  "approved",
  "approved_with_edit",
  "rejected",
  "duplicate",
];

const sourceTypes: Array<SourceDocumentType | "all"> = [
  "all",
  "own_mall",
  "naver_web",
  "naver_blog",
  "naver_news",
  "manual",
];

function sourceStatusTone(status: SourceDocumentStatus) {
  if (status === "approved" || status === "approved_with_edit") {
    return "success" as const;
  }

  if (status === "rejected" || status === "parse_failed") {
    return "danger" as const;
  }

  if (status === "review_pending" || status === "queued") {
    return "warning" as const;
  }

  if (status === "fetching" || status === "fetched") {
    return "info" as const;
  }

  return "muted" as const;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSourceHost(value: string | null) {
  if (!value) {
    return "URL 없음";
  }

  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function jsonRecord(value: Json): Record<string, Json> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, Json>;
  }

  return {};
}

function stringArray(record: Record<string, Json>, key: string) {
  const value = record[key];

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function stringValue(record: Record<string, Json>, key: string) {
  const value = record[key];

  return typeof value === "string" ? value : "";
}

function SourcesPage() {
  const [productId, setProductId] = useState<string | "all">("all");
  const [status, setStatus] = useState<SourceDocumentStatus | "all">("all");
  const [sourceType, setSourceType] = useState<SourceDocumentType | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualProductId, setManualProductId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualText, setManualText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const productsQuery = useProducts({
    pageSize: 100,
    sortBy: "name_ko",
    sortOrder: "asc",
  });
  const productOptions = productsQuery.data?.data ?? [];
  const sourcesQuery = useSourceDocuments({
    productId,
    status,
    sourceType,
    search: debouncedSearch,
    pageSize: 50,
  });
  const sources = useMemo(
    () => sourcesQuery.data?.data ?? [],
    [sourcesQuery.data?.data],
  );

  useEffect(() => {
    if (sources.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !sources.some((source) => source.id === selectedId)) {
      setSelectedId(sources[0].id);
    }
  }, [selectedId, sources]);

  useEffect(() => {
    if (!manualOpen) {
      return;
    }

    if (productId !== "all") {
      setManualProductId(productId);
      return;
    }

    if (!manualProductId && productOptions[0]) {
      setManualProductId(productOptions[0].id);
    }
  }, [manualOpen, manualProductId, productId, productOptions]);

  const sourceDetailQuery = useSourceDocument(selectedId ?? undefined);
  const selectedFromList =
    sources.find((source) => source.id === selectedId) ?? null;
  const selected = sourceDetailQuery.data ?? selectedFromList;

  useEffect(() => {
    setReviewNote("");
    setEditedMarkdown(selected?.markdown ?? selected?.raw_text ?? "");
  }, [selected?.id, selected?.markdown, selected?.raw_text]);

  const approveMutation = useApproveSource();
  const approveWithEditMutation = useApproveSourceWithEdit();
  const rejectMutation = useRejectSource();
  const duplicateMutation = useMarkSourceDuplicate();
  const addManualSourceMutation = useAddManualSource();
  const crawlMutation = useCrawlSourceDocument();
  const reviewPending =
    approveMutation.isPending ||
    approveWithEditMutation.isPending ||
    rejectMutation.isPending ||
    duplicateMutation.isPending;
  const metadata = selected ? jsonRecord(selected.extracted_metadata) : {};
  const pendingCount = sources.filter(
    (source) => source.status === "review_pending",
  ).length;

  const moveToNextPending = (currentId: string) => {
    const nextId = getNextPendingSourceId(sources, currentId);

    if (nextId) {
      setSelectedId(nextId);
    }
  };

  const handleApprove = async () => {
    if (!selected) {
      return;
    }

    await approveMutation.mutateAsync({
      id: selected.id,
      note: reviewNote,
    });
    toast.success("원문을 승인했습니다.");
    moveToNextPending(selected.id);
  };

  const handleApproveWithEdit = async () => {
    if (!selected) {
      return;
    }

    await approveWithEditMutation.mutateAsync({
      id: selected.id,
      markdown: editedMarkdown,
      note: reviewNote,
    });
    toast.success("수정본으로 승인했습니다.");
    moveToNextPending(selected.id);
  };

  const handleReject = async () => {
    if (!selected) {
      return;
    }

    if (!reviewNote.trim()) {
      toast.error("반려 사유를 입력해야 합니다.");
      return;
    }

    await rejectMutation.mutateAsync({
      id: selected.id,
      note: reviewNote,
    });
    toast.success("원문을 반려했습니다.");
    moveToNextPending(selected.id);
  };

  const handleDuplicate = async () => {
    if (!selected) {
      return;
    }

    await duplicateMutation.mutateAsync({
      id: selected.id,
      note: reviewNote || "중복 원문",
    });
    toast.success("중복 원문으로 처리했습니다.");
    moveToNextPending(selected.id);
  };

  const handleCrawl = async () => {
    if (!selected) {
      return;
    }

    try {
      await crawlMutation.mutateAsync(selected.id);
      toast.success("본문 수집을 실행했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAddManualSource = async () => {
    if (!manualProductId) {
      toast.error("제품을 선택해야 합니다.");
      return;
    }

    await addManualSourceMutation.mutateAsync({
      productId: manualProductId,
      title: manualTitle,
      sourceUrl: manualUrl,
      rawText: manualText,
      markdown: manualText,
    });
    toast.success("수동 원문을 추가했습니다.");
    setManualOpen(false);
    setManualTitle("");
    setManualUrl("");
    setManualText("");
  };

  return (
    <div className="flex min-h-0 flex-col">
      <PageHeader
        title="자료 확인"
        description="자사몰과 웹에서 모은 상품 자료를 확인하고 승인합니다."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sourcesQuery.refetch()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              새로고침
            </Button>
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
              자료 직접 추가
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-3">
        <Select
          value={productId}
          onValueChange={(value) => setProductId(value as string | "all")}
        >
          <SelectTrigger className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 제품</SelectItem>
            {productOptions.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name_ko}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as SourceDocumentStatus | "all")
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "전체 상태" : SOURCE_STATUS_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sourceType}
          onValueChange={(value) =>
            setSourceType(value as SourceDocumentType | "all")
          }
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceTypes.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "전체 출처" : SOURCE_TYPE_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="제목, 본문, URL 검색"
            className="h-9 pl-8"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          총 <span className="tabular-nums">{sourcesQuery.data?.count ?? 0}</span>
          건 · 검수 대기 <span className="tabular-nums">{pendingCount}</span>건
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-border bg-background">
          <div className="flex-1 overflow-y-auto">
            {sourcesQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                자료 목록 로딩 중
              </div>
            ) : sources.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                조건에 맞는 자료가 없습니다.
              </div>
            ) : (
              sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelectedId(source.id)}
                  className={cn(
                    "block w-full border-b border-border p-3 text-left transition-colors hover:bg-muted/40",
                    source.id === selectedId && "bg-accent/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {source.id.slice(0, 8)}
                    </span>
                    <StatusBadge tone={sourceStatusTone(source.status)}>
                      {SOURCE_STATUS_LABELS[source.status]}
                    </StatusBadge>
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium">
                    {source.title || "제목 없음"}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <StatusBadge tone="info">
                      {SOURCE_TYPE_LABELS[source.source_type]}
                    </StatusBadge>
                    <span className="truncate">
                      {getSourceHost(source.source_url)}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted-foreground">
                    {source.products?.name_ko ?? source.product_id}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatDate(source.created_at)}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              확인할 자료를 선택하세요.
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{selected.id.slice(0, 8)}</span>
                    <StatusBadge tone="info">
                      {SOURCE_TYPE_LABELS[selected.source_type]}
                    </StatusBadge>
                    <StatusBadge tone={sourceStatusTone(selected.status)}>
                      {SOURCE_STATUS_LABELS[selected.status]}
                    </StatusBadge>
                    <span>
                      신뢰도{" "}
                      <span className="tabular-nums">
                        {selected.reliability_score?.toFixed(2) ?? "-"}
                      </span>
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">
                    {selected.title || "제목 없음"}
                  </h2>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selected.products?.name_ko ?? selected.product_id}
                  </div>
                  {selected.source_url ? (
                    <a
                      href={selected.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-info hover:underline"
                    >
                      {getSourceHost(selected.source_url)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!selected.source_url || crawlMutation.isPending}
                    onClick={handleCrawl}
                  >
                    {crawlMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    본문 수집
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewPending}
                    onClick={handleApproveWithEdit}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    수정 승인
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reviewPending}
                    onClick={handleDuplicate}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    중복
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={reviewPending}
                    onClick={handleReject}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    반려
                  </Button>
                  <Button
                    size="sm"
                    disabled={reviewPending}
                    onClick={handleApprove}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    승인
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-md border border-border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label htmlFor="source-markdown">본문 Markdown</Label>
                    {sourceDetailQuery.isFetching ? (
                      <span className="inline-flex items-center text-xs text-muted-foreground">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        갱신 중
                      </span>
                    ) : null}
                  </div>
                  <Textarea
                    id="source-markdown"
                    value={editedMarkdown}
                    className="min-h-[520px] font-mono text-sm"
                    onChange={(event) => setEditedMarkdown(event.target.value)}
                  />
                </section>

                <aside className="space-y-4">
                  <section className="rounded-md border border-border bg-card p-3">
                    <h3 className="text-sm font-medium">추출 메타데이터</h3>
                    <MetadataField
                      label="요약"
                      values={[stringValue(metadata, "summary")].filter(Boolean)}
                    />
                    <MetadataField
                      label="문화 키워드"
                      values={stringArray(metadata, "cultural_keywords")}
                    />
                    <MetadataField
                      label="소재"
                      values={stringArray(metadata, "materials")}
                    />
                    <MetadataField
                      label="시대"
                      values={stringArray(metadata, "eras")}
                    />
                    <MetadataField
                      label="기법"
                      values={stringArray(metadata, "techniques")}
                    />
                  </section>

                  <section className="rounded-md border border-border bg-card p-3">
                    <Label htmlFor="review-note">검수 메모</Label>
                    <Textarea
                      id="review-note"
                      value={reviewNote}
                      placeholder="승인 근거, 수정 사항, 반려 사유"
                      className="mt-2 min-h-28"
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </section>

                  <section className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                    자료는 그대로 판매 문구로 복제하지 않고, 사실 근거와 참고
                    자료로만 사용해야 합니다.
                  </section>
                </aside>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-[680px]">
          <DialogHeader>
            <DialogTitle>자료 직접 추가</DialogTitle>
            <DialogDescription>
              외부 검색으로 찾기 어려운 자료를 제품별 검수 대기 원문으로 등록합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>제품</Label>
              <Select
                value={manualProductId || "none"}
                onValueChange={(value) =>
                  setManualProductId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    제품 선택
                  </SelectItem>
                  {productOptions.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name_ko}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-title">제목</Label>
              <Input
                id="manual-title"
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-url">출처 URL</Label>
              <Input
                id="manual-url"
                value={manualUrl}
                placeholder="https://..."
                onChange={(event) => setManualUrl(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-text">원문 내용</Label>
              <Textarea
                id="manual-text"
                value={manualText}
                className="min-h-56 font-mono text-sm"
                onChange={(event) => setManualText(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={addManualSourceMutation.isPending}
              onClick={() => setManualOpen(false)}
            >
              닫기
            </Button>
            <Button
              disabled={addManualSourceMutation.isPending}
              onClick={handleAddManualSource}
            >
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetadataField({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <StatusBadge key={value} tone="muted">
              {value}
            </StatusBadge>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">-</div>
      )}
    </div>
  );
}

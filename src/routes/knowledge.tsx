import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  Database,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMBEDDING_STATUS_LABELS,
  isLowSimilarity,
  type EmbeddingStatus,
  type KnowledgeChunk,
} from "@/lib/api/knowledge";
import { useProducts } from "@/hooks/use-products";
import {
  useEmbedProductStory,
  useKnowledgeChunks,
  useKnowledgeStats,
  useSearchSimilarChunks,
} from "@/hooks/use-knowledge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [{ title: "AI 자료 상태 · 전통문화 RAG 어드민" }],
  }),
  component: KnowledgePage,
});

const embeddingStatuses: Array<EmbeddingStatus | "all"> = [
  "all",
  "embedded",
  "pending",
  "queued",
  "embedding",
  "stale",
  "failed",
  "not_required",
];

function embeddingStatusTone(status: EmbeddingStatus | undefined) {
  if (status === "embedded") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  if (status === "pending" || status === "queued" || status === "stale") {
    return "warning" as const;
  }

  if (status === "embedding") {
    return "info" as const;
  }

  return "muted" as const;
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function KnowledgePage() {
  const [productId, setProductId] = useState<string | "all">("all");
  const [status, setStatus] = useState<EmbeddingStatus | "all">("all");
  const [chunkSearch, setChunkSearch] = useState("");
  const [debouncedChunkSearch, setDebouncedChunkSearch] = useState("");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("전통 문양과 제작 기법");
  const [topK, setTopK] = useState(5);
  const [showLowSimilarity, setShowLowSimilarity] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedChunkSearch(chunkSearch);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [chunkSearch]);

  const productsQuery = useProducts({
    pageSize: 100,
    sortBy: "name_ko",
    sortOrder: "asc",
  });
  const productOptions = productsQuery.data?.data ?? [];
  const chunksQuery = useKnowledgeChunks({
    productId,
    status,
    search: debouncedChunkSearch,
    page,
    pageSize: 12,
  });
  const statsQuery = useKnowledgeStats(productId);
  const embedMutation = useEmbedProductStory();
  const searchMutation = useSearchSimilarChunks();
  const chunks = chunksQuery.data?.data ?? [];
  const count = chunksQuery.data?.count ?? 0;
  const pageSize = chunksQuery.data?.pageSize ?? 12;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const results = searchMutation.data ?? [];
  const lowResults = useMemo(
    () => results.filter((result) => isLowSimilarity(result.similarity)),
    [results],
  );
  const visibleResults = showLowSimilarity
    ? results
    : results.filter((result) => !isLowSimilarity(result.similarity));

  const handleEmbedSelected = async () => {
    if (productId === "all") {
      toast.error("제품을 먼저 선택해야 합니다.");
      return;
    }

    await embedMutation.mutateAsync({ productId, force: true });
    toast.success("선택 제품의 지식베이스 임베딩을 실행했습니다.");
  };

  const handleEmbedAll = async () => {
    if (productOptions.length === 0) {
      toast.error("임베딩할 제품이 없습니다.");
      return;
    }

    for (const product of productOptions) {
      await embedMutation.mutateAsync({ productId: product.id, force: true });
    }

    toast.success(`제품 ${productOptions.length}개의 임베딩 작업을 실행했습니다.`);
  };

  const handleSearch = async () => {
    await searchMutation.mutateAsync({
      query,
      productId,
      topK,
      threshold: 0.5,
    });
    setShowLowSimilarity(false);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="AI 자료 상태"
        description="승인된 상품 자료가 AI 참고자료로 준비됐는지 확인합니다."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={embedMutation.isPending}
              onClick={handleEmbedSelected}
            >
              {embedMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              선택 상품 다시 준비
            </Button>
            <Button
              size="sm"
              disabled={embedMutation.isPending}
              onClick={handleEmbedAll}
            >
              <Database className="mr-1.5 h-3.5 w-3.5" />
              전체 다시 준비
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-3">
        <Select
          value={productId}
          onValueChange={(value) => {
            setProductId(value as string | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-56">
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
          onValueChange={(value) => {
            setStatus(value as EmbeddingStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {embeddingStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item === "all" ? "전체 상태" : EMBEDDING_STATUS_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={chunkSearch}
            placeholder="자료 본문 검색"
            className="h-9 pl-8"
            onChange={(event) => setChunkSearch(event.target.value)}
          />
        </div>

        <div className="ml-auto grid grid-cols-5 gap-2 text-xs">
          <Stat label="승인 자료" value={statsQuery.data?.approvedSources ?? 0} />
          <Stat label="자료 조각" value={statsQuery.data?.chunks ?? 0} />
          <Stat label="완료" value={statsQuery.data?.embedded ?? 0} />
          <Stat label="대기" value={statsQuery.data?.queued ?? 0} />
          <Stat label="실패" value={statsQuery.data?.failed ?? 0} />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <Card className="rounded-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">AI 참고자료 목록</CardTitle>
              <div className="text-sm text-muted-foreground">
                <span className="tabular-nums">{count}</span>건
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr className="h-9">
                    <th className="px-3 text-left font-medium">자료</th>
                    <th className="px-3 text-left font-medium">제품</th>
                    <th className="px-3 text-left font-medium">출처</th>
                    <th className="px-3 text-left font-medium">본문</th>
                    <th className="px-3 text-right font-medium">문자</th>
                    <th className="px-3 text-right font-medium">토큰</th>
                    <th className="px-3 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {chunksQuery.isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="h-44 text-center text-sm text-muted-foreground"
                      >
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                        자료 로딩 중
                      </td>
                    </tr>
                  ) : chunks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="h-44 text-center text-sm text-muted-foreground"
                      >
                        조건에 맞는 자료가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    chunks.map((chunk) => <ChunkRow key={chunk.id} chunk={chunk} />)
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <div className="text-sm text-muted-foreground">
                페이지 {page} / {pageCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              자료 검색 테스트
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  className="pl-8"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Select
                value={String(topK)}
                onValueChange={(value) => setTopK(Number(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">top 5</SelectItem>
                  <SelectItem value="10">top 10</SelectItem>
                  <SelectItem value="20">top 20</SelectItem>
                </SelectContent>
              </Select>
              <Button disabled={searchMutation.isPending} onClick={handleSearch}>
                {searchMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                검색
              </Button>
            </div>

            <div className="space-y-2">
              {searchMutation.isIdle ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  검색어를 입력하고 유사도 검색을 실행하세요.
                </div>
              ) : null}

              {searchMutation.isSuccess && visibleResults.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  유사도 기준을 만족하는 결과가 없습니다.
                </div>
              ) : null}

              {visibleResults.map((result) => (
                <div
                  key={result.chunk_id}
                  className={cn(
                    "rounded-md border border-border p-3 text-sm",
                    isLowSimilarity(result.similarity) && "opacity-60",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{shortId(result.chunk_id)}</span>
                      {result.source_title ? (
                        <StatusBadge tone="muted">
                          {result.source_title}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <span className="font-mono text-sm tabular-nums">
                      {result.similarity.toFixed(3)}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-muted-foreground">
                    {result.content}
                  </p>
                  {result.source_url ? (
                    <a
                      href={result.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-info hover:underline"
                    >
                      출처 열기
                    </a>
                  ) : null}
                </div>
              ))}

              {lowResults.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowLowSimilarity((current) => !current)}
                >
                  <ChevronDown
                    className={cn(
                      "mr-1.5 h-4 w-4 transition-transform",
                      showLowSimilarity && "rotate-180",
                    )}
                  />
                  낮은 유사도 결과 {lowResults.length}건{" "}
                  {showLowSimilarity ? "접기" : "표시"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-3 py-1.5 text-center">
      <div className="font-mono text-sm tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ChunkRow({ chunk }: { chunk: KnowledgeChunk }) {
  const status = chunk.embedding?.status ?? "pending";

  return (
    <tr className="h-14 hover:bg-muted/20">
      <td className="px-3 font-mono text-xs">{shortId(chunk.id)}</td>
      <td className="max-w-40 truncate px-3 text-xs">
        {chunk.product?.name_ko ?? chunk.product_id}
      </td>
      <td className="max-w-40 truncate px-3 text-xs text-muted-foreground">
        {chunk.source?.title ?? shortId(chunk.source_document_id)}
      </td>
      <td className="max-w-[360px] px-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {chunk.content}
        </p>
      </td>
      <td className="px-3 text-right font-mono text-xs tabular-nums">
        {chunk.char_length}
      </td>
      <td className="px-3 text-right font-mono text-xs tabular-nums">
        {chunk.token_count ?? "-"}
      </td>
      <td className="px-3">
        <StatusBadge tone={embeddingStatusTone(status)}>
          {EMBEDDING_STATUS_LABELS[status]}
        </StatusBadge>
      </td>
    </tr>
  );
}

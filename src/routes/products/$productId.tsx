import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Archive, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PRODUCT_STATUS_LABELS,
  type ProductStatus,
} from "@/lib/api/products";
import {
  useDeleteProduct,
  useProduct,
  useUpdateProductStatus,
} from "@/hooks/use-products";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({ meta: [{ title: "상품 상세 · 전통문화 RAG 어드민" }] }),
  component: ProductDetailPage,
});

const statuses = Object.keys(PRODUCT_STATUS_LABELS).filter(
  (status) => status !== "archived",
) as ProductStatus[];

function statusTone(status: ProductStatus) {
  if (status === "completed" || status === "knowledge_ready") {
    return "success" as const;
  }
  if (status === "review_required") {
    return "warning" as const;
  }
  if (status === "archived") {
    return "muted" as const;
  }
  return "info" as const;
}

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const productQuery = useProduct(productId);
  const updateStatusMutation = useUpdateProductStatus();
  const deleteProductMutation = useDeleteProduct();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const detail = productQuery.data;
  const product = detail?.product;

  if (productQuery.isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        상품 정보를 불러오는 중...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        상품을 찾을 수 없습니다.
        <Button variant="outline" onClick={() => navigate({ to: "/products" })}>
          상품 목록
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={product.name_ko}
        description={`${product.sku} · ${product.category}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/products" })}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              목록
            </Button>
            <Select
              value={product.status}
              onValueChange={async (value) => {
                await updateStatusMutation.mutateAsync({
                  id: product.id,
                  status: value as ProductStatus,
                });
                toast.success("상태를 변경했습니다.");
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PRODUCT_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              아카이브
            </Button>
          </>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="sources">수집 자료</TabsTrigger>
            <TabsTrigger value="knowledge">AI 자료</TabsTrigger>
            <TabsTrigger value="content">문구</TabsTrigger>
            <TabsTrigger value="images">이미지</TabsTrigger>
            <TabsTrigger value="logs">활동 로그</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <Info label="상품명" value={product.name_ko} />
                <Info label="SKU" value={product.sku} mono />
                <Info label="카테고리" value={product.category} />
                <div>
                  <p className="text-muted-foreground">상태</p>
                  <div className="mt-1">
                    <StatusBadge tone={statusTone(product.status)}>
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </StatusBadge>
                  </div>
                </div>
                <Info label="소재" value={product.materials.join(", ") || "-"} />
                <Info
                  label="문화 키워드"
                  value={product.cultural_keywords.join(", ") || "-"}
                />
                <Info label="자사몰 URL" value={product.own_mall_url || "-"} />
                <Info label="수정일" value={new Date(product.updated_at).toLocaleString("ko-KR")} />
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">설명</p>
                  <p className="mt-1 leading-6">{product.description || "-"}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">진행 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Stat label="수집 자료" value={detail.stats.sourceDocuments} />
                <Stat label="문구" value={detail.stats.contentGenerations} />
                <Stat label="이미지" value={detail.stats.imageGenerations} />
              </CardContent>
            </Card>
          </TabsContent>
          <EmptyTab value="sources" title="수집 자료" description="/sources 화면에서 상품별 자료 수집과 검수 상태를 확인합니다." />
          <EmptyTab value="knowledge" title="AI 자료" description="/knowledge 화면에서 AI 참고자료 준비 상태를 확인합니다." />
          <EmptyTab value="content" title="문구" description="/content 화면에서 생성 이력을 확인합니다." />
          <EmptyTab value="images" title="이미지" description="PHASE 7에서 이미지 갤러리를 표시합니다." />
          <EmptyTab value="logs" title="활동 로그" description="PHASE 8에서 감사 로그를 연결합니다." />
        </Tabs>
      </div>

      <ConfirmModal
        open={archiveOpen}
        title="상품을 아카이브하시겠습니까?"
        description={`${product.name_ko} 상품은 목록에서 숨겨집니다.`}
        confirmLabel="아카이브"
        onOpenChange={setArchiveOpen}
        onConfirm={async () => {
          await deleteProductMutation.mutateAsync(product.id);
          toast.success("상품을 아카이브했습니다.");
          await navigate({ to: "/products" });
        }}
      />
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={mono ? "mt-1 font-mono text-xs" : "mt-1"}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}

function EmptyTab({
  value,
  title,
  description,
}: {
  value: string;
  title: string;
  description: string;
}) {
  return (
    <TabsContent value={value}>
      <div className="flex min-h-52 flex-col justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </TabsContent>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ColumnDef, PaginationState, SortingState } from "@tanstack/react-table";
import { Download, MoreHorizontal, Pencil, Play, Plus, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CollectionJobModal } from "@/components/collection-job-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { CsvImportModal } from "@/components/csv-import-modal";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/product-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_STATUS_LABELS,
  type Product,
  type ProductInsert,
  type ProductStatus,
} from "@/lib/api/products";
import { showError } from "@/lib/errors/toast-handler";
import {
  useCreateProduct,
  useDeleteProduct,
  useImportCSV,
  useProducts,
  useUpdateProduct,
} from "@/hooks/use-products";
import { useCreateCollectionJob } from "@/hooks/use-sources";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "상품 등록 · 전통문화 RAG 어드민" }] }),
  component: ProductsPage,
});

const productStatuses: ProductStatus[] = [
  "draft",
  "collecting",
  "review_required",
  "knowledge_ready",
  "content_ready",
  "image_ready",
  "completed",
];

function productStatusTone(status: ProductStatus) {
  if (status === "completed" || status === "knowledge_ready") {
    return "success" as const;
  }
  if (status === "collecting" || status === "content_ready" || status === "image_ready") {
    return "info" as const;
  }
  if (status === "review_required") {
    return "warning" as const;
  }
  return "muted" as const;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const sort = sorting[0];
  const productsQuery = useProducts({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: debouncedSearch,
    status,
    category,
    sortBy: sort?.id,
    sortOrder: sort?.desc ? "desc" : "asc",
  });
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const importCsvMutation = useImportCSV();
  const createCollectionJobMutation = useCreateCollectionJob();
  const products = productsQuery.data?.data ?? [];
  const totalCount = productsQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            aria-label={`${row.original.name_ko} 선택`}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={(checked) => {
              setSelectedIds((current) =>
                checked
                  ? Array.from(new Set([...current, row.original.id]))
                  : current.filter((id) => id !== row.original.id),
              );
            }}
          />
        ),
      },
      {
        id: "thumbnail",
        header: "",
        enableSorting: false,
        cell: () => <div className="h-10 w-10 rounded-md bg-gradient-to-br from-muted to-accent" />,
      },
      {
        accessorKey: "name_ko",
        header: "제품명",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name_ko}</p>
            {row.original.description ? (
              <p className="mt-0.5 line-clamp-1 max-w-[360px] text-xs text-muted-foreground">
                {row.original.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
        ),
      },
      {
        accessorKey: "category",
        header: "카테고리",
        cell: ({ row }) => <StatusBadge tone="muted">{row.original.category}</StatusBadge>,
      },
      {
        accessorKey: "status",
        header: "상태",
        cell: ({ row }) => (
          <StatusBadge tone={productStatusTone(row.original.status)}>
            {PRODUCT_STATUS_LABELS[row.original.status]}
          </StatusBadge>
        ),
      },
      {
        accessorKey: "materials",
        header: "소재",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.materials.slice(0, 2).join(", ") || "-"}
          </span>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "수정일",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatDate(row.original.updated_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={`${row.original.name_ko} 작업`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingProduct(row.original);
                  setFormOpen(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                편집
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  setArchiveTarget(row.original);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                아카이브
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [selectedIds],
  );

  const handleSaveProduct = async (data: ProductInsert) => {
    try {
      if (editingProduct) {
        await updateProductMutation.mutateAsync({
          id: editingProduct.id,
          data,
        });
        toast.success("제품을 수정했습니다.");
      } else {
        await createProductMutation.mutateAsync(data);
        toast.success("제품을 추가했습니다.");
      }

      setFormOpen(false);
      setEditingProduct(null);
    } catch (error) {
      showError(error);
    }
  };

  const exportCurrentRows = () => {
    const header = "sku,name_ko,category,status,updated_at";
    const rows = products.map((product) =>
      [product.sku, product.name_ko, product.category, product.status, product.updated_at]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "products.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        title="상품 등록"
        description="상품을 추가하거나 자사몰 상품 목록을 가져옵니다."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> CSV 가져오기
            </Button>
            <Button variant="outline" size="sm" onClick={exportCurrentRows}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> 내보내기
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCollectionOpen(true)}>
              <Play className="mr-1.5 h-3.5 w-3.5" /> 자료 수집 시작
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> 상품 추가
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder="제품명, SKU, 카테고리 검색"
            className="h-9 pl-8"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as ProductStatus | "all");
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {productStatuses.map((productStatus) => (
              <SelectItem key={productStatus} value={productStatus}>
                {PRODUCT_STATUS_LABELS[productStatus]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPagination((current) => ({ ...current, pageIndex: 0 }));
          }}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          {products.length} / <span className="tabular-nums">{totalCount}</span> 표시 중
        </div>
      </div>

      <div className="p-6">
        <DataTable
          columns={columns}
          data={products}
          pageCount={pageCount}
          pagination={pagination}
          sorting={sorting}
          isLoading={productsQuery.isLoading}
          emptyTitle="등록된 제품이 없습니다"
          emptyDescription="제품을 추가하거나 CSV로 가져오세요."
          onPaginationChange={setPagination}
          onSortingChange={setSorting}
          onRowClick={(row) =>
            void navigate({
              to: "/products/$productId",
              params: { productId: row.original.id },
            })
          }
        />
      </div>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "제품 편집" : "제품 추가"}</DialogTitle>
            <DialogDescription>제품 기본 정보와 문화 키워드를 입력합니다.</DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            isSubmitting={createProductMutation.isPending || updateProductMutation.isPending}
            onCancel={() => setFormOpen(false)}
            onSubmit={handleSaveProduct}
          />
        </DialogContent>
      </Dialog>

      <CsvImportModal
        open={csvOpen}
        isImporting={importCsvMutation.isPending}
        onOpenChange={setCsvOpen}
        onImport={async (csvText) => {
          const result = await importCsvMutation.mutateAsync(csvText);
          if (result.errors.length > 0) {
            toast.error("CSV 오류를 먼저 수정하세요.");
            return;
          }
          toast.success(`제품 ${result.inserted}건을 가져왔습니다.`);
          setCsvOpen(false);
        }}
      />

      <CollectionJobModal
        open={collectionOpen}
        selectedCount={selectedIds.length}
        selectedProductIds={selectedIds}
        isSubmitting={createCollectionJobMutation.isPending}
        onOpenChange={setCollectionOpen}
        onStart={async (params) => {
          await createCollectionJobMutation.mutateAsync(params);
          toast.success("수집 작업을 생성했습니다.");
          setCollectionOpen(false);
        }}
      />

      <ConfirmModal
        open={Boolean(archiveTarget)}
        title="제품을 아카이브하시겠습니까?"
        description={archiveTarget ? `${archiveTarget.name_ko} 제품은 목록에서 숨겨집니다.` : ""}
        confirmLabel="아카이브"
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={async () => {
          if (!archiveTarget) {
            return;
          }
          await deleteProductMutation.mutateAsync(archiveTarget.id);
          toast.success("제품을 아카이브했습니다.");
          setArchiveTarget(null);
        }}
      />
    </div>
  );
}

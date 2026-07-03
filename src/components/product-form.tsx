import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  checkProductSkuExists,
  splitProductListValue,
  type Product,
  type ProductInsert,
} from "@/lib/api/products";
import { handleApiError } from "@/lib/errors/error-handler";

const productSchema = z.object({
  sku: z.string().min(1, "필수 입력 항목입니다."),
  name_ko: z.string().min(1, "필수 입력 항목입니다."),
  name_en: z.string().optional(),
  category: z.string().min(1, "필수 입력 항목입니다."),
  materials: z.string().optional(),
  cultural_keywords: z.string().optional(),
  own_mall_url: z.string().url("올바른 URL 형식이 아닙니다.").optional().or(z.literal("")),
  description: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

type ProductFormProps = {
  product?: Product | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (data: ProductInsert) => void | Promise<void>;
};

function toFormValues(product?: Product | null): ProductFormValues {
  return {
    sku: product?.sku ?? "",
    name_ko: product?.name_ko ?? "",
    name_en: product?.name_en ?? "",
    category: product?.category ?? "",
    materials: product?.materials.join(", ") ?? "",
    cultural_keywords: product?.cultural_keywords.join(", ") ?? "",
    own_mall_url: product?.own_mall_url ?? "",
    description: product?.description ?? "",
  };
}

function toPayload(values: ProductFormValues): ProductInsert {
  return {
    sku: values.sku.trim(),
    name_ko: values.name_ko.trim(),
    name_en: values.name_en?.trim() || undefined,
    category: values.category.trim(),
    materials: splitProductListValue(values.materials),
    cultural_keywords: splitProductListValue(values.cultural_keywords),
    own_mall_url: values.own_mall_url?.trim() || undefined,
    description: values.description?.trim() || undefined,
  };
}

export function ProductForm({ product, isSubmitting, onCancel, onSubmit }: ProductFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    clearErrors,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toFormValues(product),
  });

  useEffect(() => {
    reset(toFormValues(product));
  }, [product, reset]);

  const skuRegistration = register("sku");

  return (
    <form className="space-y-4" onSubmit={handleSubmit((values) => onSubmit(toPayload(values)))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            {...skuRegistration}
            onBlur={async (event) => {
              skuRegistration.onBlur(event);
              const sku = event.target.value.trim();

              if (!sku || sku === product?.sku) {
                clearErrors("sku");
                return;
              }

              let exists = false;

              try {
                exists = await checkProductSkuExists(sku, product?.id);
              } catch (error) {
                const handled = handleApiError(error);

                setError("sku", {
                  message: handled.message,
                });
                return;
              }

              if (exists) {
                setError("sku", {
                  message: "이미 등록된 SKU입니다.",
                });
              } else {
                clearErrors("sku");
              }
            }}
          />
          {errors.sku ? <p className="text-sm text-destructive">{errors.sku.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">카테고리</Label>
          <Input id="category" {...register("category")} />
          {errors.category ? (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name_ko">제품명</Label>
          <Input id="name_ko" {...register("name_ko")} />
          {errors.name_ko ? (
            <p className="text-sm text-destructive">{errors.name_ko.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_en">영문명</Label>
          <Input id="name_en" {...register("name_en")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="materials">소재</Label>
          <Input id="materials" placeholder="쉼표로 구분" {...register("materials")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cultural_keywords">문화 키워드</Label>
          <Input
            id="cultural_keywords"
            placeholder="쉼표로 구분"
            {...register("cultural_keywords")}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="own_mall_url">자사몰 URL</Label>
        <Input id="own_mall_url" type="url" {...register("own_mall_url")} />
        {errors.own_mall_url ? (
          <p className="text-sm text-destructive">{errors.own_mall_url.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">설명</Label>
        <Textarea id="description" rows={4} {...register("description")} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          저장
        </Button>
      </div>
    </form>
  );
}

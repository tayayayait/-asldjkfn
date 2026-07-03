import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  approveImage,
  exportImage,
  fetchImageGenerations,
  fetchProductAssets,
  generateImage,
  rejectImage,
  uploadProductImage,
  type ExportSizeKey,
  type GenerateImageParams,
  type ImageGenerationFilters,
  type UploadProductImageParams,
} from "@/lib/api/images";

export function useProductAssets(productId?: string) {
  return useQuery({
    queryKey: ["product-assets", productId],
    queryFn: () => fetchProductAssets(productId),
    enabled: Boolean(productId),
    staleTime: 20_000,
  });
}

export function useImageGenerations(filters: ImageGenerationFilters = {}) {
  return useQuery({
    queryKey: ["image-generations", filters],
    queryFn: () => fetchImageGenerations(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useUploadProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UploadProductImageParams) => uploadProductImage(params),
    onSuccess: async (asset) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["product-assets", asset.product_id],
        }),
        queryClient.invalidateQueries({ queryKey: ["product", asset.product_id] }),
      ]);
    },
  });
}

export function useGenerateImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GenerateImageParams) => generateImage(params),
    onSuccess: async (image) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["image-generations"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product", image.product_id] }),
      ]);
    },
  });
}

export function useApproveImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveImage(id, note),
    onSuccess: async (image) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["image-generations"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product", image.product_id] }),
      ]);
    },
  });
}

export function useRejectImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectImage(id, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["image-generations"] });
    },
  });
}

export function useExportImage() {
  return useMutation({
    mutationFn: ({ id, sizes }: { id: string; sizes: ExportSizeKey[] }) =>
      exportImage(id, sizes),
  });
}

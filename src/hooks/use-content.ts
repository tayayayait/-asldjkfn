import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  approveContent,
  fetchContentGeneration,
  fetchContentGenerations,
  generateContent,
  rejectContent,
  submitContentForReview,
  updateContentText,
  type ContentGenerationFilters,
  type GenerateContentParams,
} from "@/lib/api/content";

export function useContentGenerations(filters: ContentGenerationFilters = {}) {
  return useQuery({
    queryKey: ["content-generations", filters],
    queryFn: () => fetchContentGenerations(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useContentGeneration(id: string | undefined) {
  return useQuery({
    queryKey: ["content-generation", id],
    queryFn: () => fetchContentGeneration(id!),
    enabled: Boolean(id),
    staleTime: 20_000,
  });
}

export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GenerateContentParams) => generateContent(params),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-generations"] }),
        queryClient.invalidateQueries({
          queryKey: ["content-generation", generation.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({
          queryKey: ["product", generation.product_id],
        }),
      ]);
    },
  });
}

export function useUpdateContentText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateContentText(id, text),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-generations"] }),
        queryClient.invalidateQueries({
          queryKey: ["content-generation", generation.id],
        }),
      ]);
    },
  });
}

export function useSubmitContentForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => submitContentForReview(id),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-generations"] }),
        queryClient.invalidateQueries({
          queryKey: ["content-generation", generation.id],
        }),
      ]);
    },
  });
}

export function useApproveContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveContent(id, note),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-generations"] }),
        queryClient.invalidateQueries({
          queryKey: ["content-generation", generation.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({
          queryKey: ["product", generation.product_id],
        }),
      ]);
    },
  });
}

export function useRejectContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectContent(id, note),
    onSuccess: async (generation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["content-generations"] }),
        queryClient.invalidateQueries({
          queryKey: ["content-generation", generation.id],
        }),
      ]);
    },
  });
}

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  embedProductStory,
  fetchKnowledgeChunks,
  fetchKnowledgeStats,
  searchSimilarChunks,
  type EmbedProductStoryParams,
  type KnowledgeFilters,
  type SimilaritySearchParams,
} from "@/lib/api/knowledge";

export function useKnowledgeChunks(filters: KnowledgeFilters) {
  return useQuery({
    queryKey: ["knowledge-chunks", filters],
    queryFn: () => fetchKnowledgeChunks(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useKnowledgeStats(productId?: string | "all") {
  return useQuery({
    queryKey: ["knowledge-stats", productId ?? "all"],
    queryFn: () => fetchKnowledgeStats(productId),
    staleTime: 20_000,
  });
}

export function useEmbedProductStory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: EmbedProductStoryParams) => embedProductStory(params),
    onSuccess: async (_data, params) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["knowledge-chunks"] }),
        queryClient.invalidateQueries({ queryKey: ["knowledge-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product", params.productId] }),
      ]);
    },
  });
}

export function useSearchSimilarChunks() {
  return useMutation({
    mutationFn: (params: SimilaritySearchParams) => searchSimilarChunks(params),
  });
}

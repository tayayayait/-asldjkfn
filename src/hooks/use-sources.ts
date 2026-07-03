import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addManualSource,
  approveSource,
  approveSourceWithEdit,
  crawlSourceDocument,
  createCollectionJob,
  fetchSourceDocument,
  fetchSourceDocuments,
  markSourceDuplicate,
  rejectSource,
  type CreateCollectionJobParams,
  type ManualSourceInput,
  type SourceDocumentFilters,
} from "@/lib/api/sources";

export function useSourceDocuments(filters: SourceDocumentFilters) {
  return useQuery({
    queryKey: ["source-documents", filters],
    queryFn: () => fetchSourceDocuments(filters),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}

export function useSourceDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["source-document", id],
    queryFn: () => fetchSourceDocument(id!),
    enabled: Boolean(id),
    staleTime: 20_000,
  });
}

function useSourceReviewInvalidation() {
  const queryClient = useQueryClient();

  return async (sourceId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["source-documents"] }),
      sourceId
        ? queryClient.invalidateQueries({ queryKey: ["source-document", sourceId] })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ]);
  };
}

export function useApproveSource() {
  const invalidate = useSourceReviewInvalidation();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      approveSource(id, note),
    onSuccess: (source) => invalidate(source.id),
  });
}

export function useApproveSourceWithEdit() {
  const invalidate = useSourceReviewInvalidation();

  return useMutation({
    mutationFn: ({
      id,
      markdown,
      note,
    }: {
      id: string;
      markdown: string;
      note?: string;
    }) => approveSourceWithEdit(id, markdown, note),
    onSuccess: (source) => invalidate(source.id),
  });
}

export function useRejectSource() {
  const invalidate = useSourceReviewInvalidation();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectSource(id, note),
    onSuccess: (source) => invalidate(source.id),
  });
}

export function useMarkSourceDuplicate() {
  const invalidate = useSourceReviewInvalidation();

  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      markSourceDuplicate(id, note),
    onSuccess: (source) => invalidate(source.id),
  });
}

export function useAddManualSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManualSourceInput) => addManualSource(input),
    onSuccess: async (source) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["source-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["source-document", source.id] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });
}

export function useCreateCollectionJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateCollectionJobParams) =>
      createCollectionJob(params),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["source-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      ]);
    },
  });
}

export function useCrawlSourceDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => crawlSourceDocument(id),
    onSettled: async (_data, _error, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["source-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["source-document", id] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      ]);
    },
  });
}

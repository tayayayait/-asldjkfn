import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPromptTemplate,
  createPromptTemplateVersion,
  deletePromptTemplate,
  fetchPromptTemplate,
  fetchPromptTemplates,
  testPromptTemplate,
  togglePromptActive,
  updatePromptTemplate,
  type PromptTemplateFilters,
  type PromptTemplateInput,
  type PromptTemplateVersionInput,
} from "@/lib/api/prompts";

export function usePromptTemplates(filters: PromptTemplateFilters = {}) {
  return useQuery({
    queryKey: ["prompt-templates", filters],
    queryFn: () => fetchPromptTemplates(filters),
    staleTime: 20_000,
  });
}

export function usePromptTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["prompt-template", id],
    queryFn: () => fetchPromptTemplate(id!),
    enabled: Boolean(id),
    staleTime: 20_000,
  });
}

export function useCreatePromptTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PromptTemplateInput) => createPromptTemplate(input),
    onSuccess: async (template) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
        queryClient.invalidateQueries({
          queryKey: ["prompt-template", template.id],
        }),
      ]);
    },
  });
}

export function useCreatePromptTemplateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: PromptTemplateVersionInput;
    }) => createPromptTemplateVersion(id, input),
    onSuccess: async (template) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
        queryClient.invalidateQueries({
          queryKey: ["prompt-template", template.id],
        }),
      ]);
    },
  });
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<PromptTemplateInput>;
    }) => updatePromptTemplate(id, input),
    onSuccess: async (template) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["prompt-templates"] }),
        queryClient.invalidateQueries({
          queryKey: ["prompt-template", template.id],
        }),
      ]);
    },
  });
}

export function useTogglePromptActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      togglePromptActive(id, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt-templates"] });
    },
  });
}

export function useDeletePromptTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePromptTemplate(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt-templates"] });
    },
  });
}

export function useTestPromptTemplate() {
  return useMutation({
    mutationFn: ({
      id,
      variables,
    }: {
      id: string;
      variables: Record<string, unknown>;
    }) => testPromptTemplate(id, variables),
  });
}

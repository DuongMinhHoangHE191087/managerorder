import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api/fetcher";
import { queryKeys } from "@/shared/lib/react-query/query-keys";
import type { ProductService } from "@/lib/domain/types";
import { fetchRecoverableDetail } from "@/shared/lib/recoverable-detail";

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => fetcher<ProductService[]>("/api/products"),
    staleTime: 5 * 60_000, // 5 min — products rarely change
  });
}

export function useProductDetail(productId: string | null, includeDeleted = false) {
  return useQuery({
    queryKey: productId ? [...queryKeys.product(productId), includeDeleted ? "trash" : "active"] : ["products", "detail", "missing"],
    queryFn: () => fetchRecoverableDetail<ProductService>(`/api/products/${productId}`, includeDeleted),
    enabled: Boolean(productId),
    staleTime: 30_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetcher<ProductService>("/api/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      fetcher<ProductService>(`/api/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (updatedProduct) => {
      // Cáº­p nháº­t UI ngay láº­p tá»©c
      queryClient.setQueryData(queryKeys.products, (old: ProductService[] | undefined) =>
        old ? old.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)) : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetcher<{ message: string }>(`/api/products/${id}`, {
        method: "DELETE",
      }),
    // Optimistic update: remove product from UI immediately
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const previous = queryClient.getQueryData<ProductService[]>(queryKeys.products);
      queryClient.setQueryData(queryKeys.products, (old: ProductService[] | undefined) =>
        old?.filter(p => p.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.products, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}


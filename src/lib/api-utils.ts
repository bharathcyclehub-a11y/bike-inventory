import { NextResponse } from "next/server";

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function paginatedResponse(
  data: unknown[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
}

export function parseSearchParams(url: string) {
  const { searchParams } = new URL(url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  const skip = (page - 1) * limit;

  const ALLOWED_SORT = ["createdAt", "updatedAt", "name", "sku", "currentStock", "costPrice", "sellingPrice", "dueDate", "billDate", "amount"];
  const rawSort = searchParams.get("sortBy") || "createdAt";
  const sortBy = ALLOWED_SORT.includes(rawSort) ? rawSort : "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") === "asc" ? "asc" as const : "desc" as const;

  const search = searchParams.get("search") || undefined;

  return { page, limit, skip, sortBy, sortOrder, search, searchParams };
}

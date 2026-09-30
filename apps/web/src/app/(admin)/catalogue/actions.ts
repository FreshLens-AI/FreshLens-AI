"use server";

import { revalidatePath } from "next/cache";

import { adminApiFetch } from "@/lib/api/client";
import type { CategoryShelfLife } from "@/types/domain";

export interface ShelfLifeActionState {
  status: "saved" | "error" | null;
  message: string;
}

const categories = new Set<CategoryShelfLife["category"]>([
  "banana", "cucumber", "eggplant", "tomato",
]);

function parseDays(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const days = Number(value);
  return Number.isSafeInteger(days) && days >= 1 && days <= 3650 ? days : null;
}

export async function updateCategoryShelfLife(
  category: CategoryShelfLife["category"],
  _previous: ShelfLifeActionState,
  formData: FormData,
): Promise<ShelfLifeActionState> {
  if (!categories.has(category)) {
    return { status: "error", message: "Choose a supported product category." };
  }
  const freshToMedium = parseDays(formData.get("fresh_to_medium_days"));
  const mediumToSpoiled = parseDays(formData.get("medium_to_spoiled_days"));
  if (freshToMedium === null || mediumToSpoiled === null) {
    return { status: "error", message: "Enter whole numbers from 1 to 3650 for both stages." };
  }

  const response = await adminApiFetch(`api/v1/admin/shelf-life-rules/${category}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fresh_to_medium_days: freshToMedium,
      medium_to_spoiled_days: mediumToSpoiled,
    }),
  });
  if (!response.ok) {
    return { status: "error", message: `Could not save the rule (${response.status}). Please try again.` };
  }
  revalidatePath("/catalogue");
  return { status: "saved", message: `${category[0].toUpperCase()}${category.slice(1)} shelf life saved.` };
}

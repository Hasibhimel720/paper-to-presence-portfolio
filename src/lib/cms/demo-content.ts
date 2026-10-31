import { contentSnapshotSchema, type ContentSnapshot } from "@/lib/cms/schema";
import { portfolioRepository } from "@/lib/cms/repository";

export async function createDemoContent(): Promise<ContentSnapshot> {
  const snapshot = await portfolioRepository.getPublishedSnapshot();
  if (!snapshot) {
    throw new Error("The static portfolio baseline is unavailable.");
  }

  return contentSnapshotSchema.parse(snapshot);
}

import type { CollectionEntry } from "astro:content";
import { BLOG_PAGE_SIZE } from "@config";
import { getAllPosts, getPostsWithStats, sortPostsByDate, sortPostsByPinAndDate } from "./blogUtils";

/**
 * Ana blog sayfası için sayfalama verilerini getirir
 * @param paginate Astro sayfalama (paginate) fonksiyonu
 * @returns Sayfalama yolu verileri
 */
export async function getMainBlogPaginationPaths({ paginate }: { paginate: any }) {
  const allPosts = await getAllPosts();
  const sortedPosts = sortPostsByPinAndDate(allPosts);
  const postsWithStats = await getPostsWithStats(sortedPosts);

  return paginate(postsWithStats, { pageSize: BLOG_PAGE_SIZE });
}

/**
 * Belirli bir etikete sahip blog yazılarının sayfalama verilerini getirir
 * @param paginate Astro sayfalama (paginate) fonksiyonu
 * @returns Sayfalama yolu verileri
 */
export async function getTagPaginationPaths({ paginate }: { paginate: any }) {
  const allPosts = await getAllPosts();
  const sortedPosts = sortPostsByDate(allPosts);
  const allTags = [...new Set(sortedPosts.flatMap((blog: CollectionEntry<"blog">) => blog.data.tags || []))];
  const postsWithStats = await getPostsWithStats(sortedPosts);

  return allTags.flatMap((tag) => {
    const filteredPosts = postsWithStats.filter((blog: any) => blog.data.tags?.includes(tag));
    return paginate(filteredPosts, {
      params: { tag },
      pageSize: BLOG_PAGE_SIZE,
    });
  });
}

/**
 * Belirli bir kategoriye sahip blog yazılarının sayfalama verilerini getirir
 * @param paginate Astro sayfalama (paginate) fonksiyonu
 * @returns Sayfalama yolu verileri
 */
export async function getCategoryPaginationPaths({ paginate }: { paginate: any }) {
  const allPosts = await getAllPosts();
  const sortedPosts = sortPostsByDate(allPosts);
  const allCategories = [...new Set(sortedPosts.flatMap((blog: CollectionEntry<"blog">) => blog.data.categories || []))];
  const postsWithStats = await getPostsWithStats(sortedPosts);

  return allCategories.flatMap((category) => {
    const filteredPosts = postsWithStats.filter((blog: any) => blog.data.categories?.includes(category));
    return paginate(filteredPosts, {
      params: { category },
      pageSize: BLOG_PAGE_SIZE,
    });
  });
}

/**
 * "Kitaplar" kategorisine veya etiketine sahip blog yazılarının sayfalama verilerini getirir
 * @param paginate Astro sayfalama (paginate) fonksiyonu
 * @param pageSize Sayfa başına yazı sayısı (varsayılan: 7 veya BLOG_PAGE_SIZE)
 * @returns Sayfalama yolu verileri
 */
export async function getBooksPaginationPaths({ paginate, pageSize = BLOG_PAGE_SIZE || 7 }: { paginate: any; pageSize?: number }) {
  const allPosts = await getAllPosts();
  const bookPosts = allPosts.filter(
    post =>
      post.data.categories?.some((cat: string) => cat.toLowerCase() === "kitaplar")
      || post.data.tags?.some((tag: string) => tag.toLowerCase() === "kitaplar"),
  );
  const sortedBookPosts = sortPostsByDate(bookPosts);
  const postsWithStats = await getPostsWithStats(sortedBookPosts);

  return paginate(postsWithStats, { pageSize });
}

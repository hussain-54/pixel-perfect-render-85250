export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";

/** JSON-serializable TipTap document (and similar). */
export type BlogContentJson =
  string | number | boolean | null | BlogContentJson[] | { [key: string]: BlogContentJson };

export type BlogAuthor = {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  active: boolean;
  profileId: string | null;
};

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
};

export type BlogTag = {
  id: string;
  name: string;
  slug: string;
};

export type BlogPostListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  scheduledFor: string | null;
  updatedAt: string;
  readingTimeMinutes: number;
  isFeatured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  featuredImageUrl: string | null;
  draftVersion: number;
};

export type BlogPostDetail = BlogPostListItem & {
  contentJson: BlogContentJson;
  contentHtml: string;
  featuredImageAlt: string;
  categoryId: string | null;
  authorId: string | null;
  tagIds: string[];
  tagNames: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  canonicalPath: string | null;
  robotsIndex: boolean;
  createdAt: string;
};

export type BlogPostWriteInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  contentJson: BlogContentJson;
  contentHtml: string;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string;
  categoryId?: string | null;
  authorId?: string | null;
  tagIds?: string[];
  status: BlogPostStatus;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  isFeatured?: boolean;
  readingTimeMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string | null;
  canonicalPath?: string | null;
  robotsIndex?: boolean;
  expectedDraftVersion?: number;
};

export type BlogDashboardStats = {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  archived: number;
  schemaReady: boolean;
  note: string | null;
};

export type PublicBlogCard = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  publishedAt: string;
  readingTimeMinutes: number;
  isFeatured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
};

export type PublicBlogArticle = PublicBlogCard & {
  contentHtml: string;
  authorBio: string | null;
  authorAvatarUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string | null;
  canonicalPath: string | null;
  robotsIndex: boolean;
  tagNames: string[];
};

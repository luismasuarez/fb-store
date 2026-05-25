export interface ScrapedPost {
  fbPostId: string;
  text: string;
  images: string[];
  author: string;
  authorUrl: string;
  timestamp: string;
  postUrl: string;
}

export interface ScrapeOptions {
  groupId: string;
  maxPosts: number;
}

export interface ScraperResult {
  groupId: string;
  posts: ScrapedPost[];
  scrapedAt: string;
}

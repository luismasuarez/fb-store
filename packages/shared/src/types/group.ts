export interface Group {
  id: string;
  name: string;
  url: string | null;
  maxPosts: number;
  lastScraped: string | null;
  lastError: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface GroupConfig {
  id: string;
  name: string;
  maxPosts: number;
}

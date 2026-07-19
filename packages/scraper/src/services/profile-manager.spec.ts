import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReaddir = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();
const mockRm = vi.fn();
const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  readdir: mockReaddir,
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  rm: mockRm,
  access: mockAccess,
  readFile: mockReadFile,
}));

const mockCreateContext = vi.fn();

vi.mock("../browser", () => ({
  getProfileDir: (name: string) => `/mock/profiles/${name}`,
  createContext: mockCreateContext,
}));

const { listProfiles, checkSession } = await import("./profile-manager");

describe("profile-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROFILE_DIR = "/mock/profiles";
  });

  describe("listProfiles", () => {
    it("reads directories under PROFILE_DIR with .meta.json", async () => {
      mockReaddir.mockResolvedValue([
        { name: "cuenta-1", isDirectory: () => true },
        { name: "cuenta-2", isDirectory: () => true },
      ]);
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes("cuenta-1")) {
          return JSON.stringify({ createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" });
        }
        return JSON.stringify({ createdAt: "2026-01-02T00:00:00.000Z", loginStatus: "alive" });
      });

      const profiles = await listProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe("cuenta-1");
      expect(profiles[0].loginStatus).toBe("unknown");
      expect(profiles[1].name).toBe("cuenta-2");
      expect(profiles[1].loginStatus).toBe("alive");
    });
  });

  describe("checkSession", () => {
    beforeEach(() => {
      mockReaddir.mockResolvedValue(["dir-entry"]); // profile dir exists
    });

    function makeMockPage(url: string, hasFeed: boolean) {
      return {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        url: vi.fn().mockReturnValue(url),
        evaluate: vi.fn().mockResolvedValue(hasFeed),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }

    function makeMockContext(mockPage: ReturnType<typeof makeMockPage>) {
      return {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }

    it("detects feed visible", async () => {
      const mockPage = makeMockPage("https://facebook.com/", true);
      mockCreateContext.mockResolvedValue(makeMockContext(mockPage));

      const result = await checkSession("cuenta-1");
      expect(result.alive).toBe(true);
      expect(result.reason).toBe("feed-visible");
    });

    it("detects redirect to login", async () => {
      const mockPage = makeMockPage("https://facebook.com/login/", false);
      mockCreateContext.mockResolvedValue(makeMockContext(mockPage));

      const result = await checkSession("cuenta-1");
      expect(result.alive).toBe(false);
      expect(result.reason).toBe("redirected-to-login");
    });
  });
});

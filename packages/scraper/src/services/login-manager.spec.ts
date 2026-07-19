import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLaunchPersistentContext = vi.fn();
const mockWriteFile = vi.fn();
const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockHomedir = vi.fn();

vi.mock("playwright", () => ({
  chromium: {
    launchPersistentContext: mockLaunchPersistentContext,
  },
}));

vi.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
}));

vi.mock("node:os", () => ({
  homedir: mockHomedir,
}));

const { startLogin, getStatus, completeLogin, _clearSessions } = await import("./login-manager");

describe("login-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROFILE_DIR = "/mock/profiles";
    _clearSessions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startLogin", () => {
    it("opens Chrome with Playwright Chromium (default path) [T049]", async () => {
      const mockPage = { goto: vi.fn().mockResolvedValue(undefined) };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        waitForEvent: vi.fn(() => new Promise(() => {})),
      };
      mockLaunchPersistentContext.mockResolvedValue(mockContext);

      const session = await startLogin("cuenta-1");

      expect(mockLaunchPersistentContext).toHaveBeenCalledWith(
        "/mock/profiles/cuenta-1",
        expect.objectContaining({
          headless: false,
          viewport: { width: 1280, height: 900 },
          locale: "es-VE",
        }),
      );

      expect(mockContext.newPage).toHaveBeenCalledOnce();
      expect(mockPage.goto).toHaveBeenCalledWith(
        "https://facebook.com",
        expect.objectContaining({ timeout: 30000 }),
      );

      expect(session.profile).toBe("cuenta-1");
      expect(session.state).toBe("login-in-progress");
      expect(session.vncUrl).toBe("http://scraper:6080/vnc.html?password=fbstore");
      expect(session.startedAt).toBeDefined();
    });

    it("falls back to system Chrome when Playwright Chromium is missing", async () => {
      const mockPage = { goto: vi.fn().mockResolvedValue(undefined) };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        waitForEvent: vi.fn(() => new Promise(() => {})),
      };
      mockLaunchPersistentContext
        .mockRejectedValueOnce(new Error("Executable doesn't exist"))
        .mockResolvedValueOnce(mockContext);

      mockHomedir.mockReturnValue("/home/user");
      mockReaddirSync.mockReturnValue([]);
      mockExistsSync.mockImplementation((p: string) => p === "/usr/bin/brave-browser");

      const session = await startLogin("cuenta-1");

      expect(mockLaunchPersistentContext).toHaveBeenNthCalledWith(
        2,
        "/mock/profiles/cuenta-1",
        expect.objectContaining({
          executablePath: "/usr/bin/brave-browser",
        }),
      );
      expect(session.state).toBe("login-in-progress");
    });

    it("throws clear error when no Chrome is found at all", async () => {
      mockLaunchPersistentContext.mockRejectedValue(new Error("Executable doesn't exist"));
      mockHomedir.mockReturnValue("/home/user");
      mockReaddirSync.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);

      await expect(startLogin("cuenta-1")).rejects.toThrow(
        "BUSINESS:No Chromium disponible para login. Ejecuta: npx playwright install chromium",
      );
    });

    it("throws BUSINESS error if login already in progress", async () => {
      const mockPage = { goto: vi.fn().mockResolvedValue(undefined) };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        waitForEvent: vi.fn(() => new Promise(() => {})),
      };
      mockLaunchPersistentContext.mockResolvedValue(mockContext);

      await startLogin("cuenta-1");
      await expect(startLogin("cuenta-1")).rejects.toThrow("BUSINESS:Login already in progress");
    });
  });

  describe("getStatus", () => {
    it("returns undefined for unknown profile", () => {
      expect(getStatus("unknown")).toBeUndefined();
    });

    it("returns session for active login", async () => {
      const mockPage = { goto: vi.fn().mockResolvedValue(undefined) };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        waitForEvent: vi.fn(() => new Promise(() => {})),
      };
      mockLaunchPersistentContext.mockResolvedValue(mockContext);

      await startLogin("cuenta-1");
      const status = getStatus("cuenta-1");

      expect(status).toBeDefined();
      expect(status!.state).toBe("login-in-progress");
    });
  });

  describe("completeLogin", () => {
    it("persists profile meta and marks logged-in", async () => {
      const mockPage = { goto: vi.fn().mockResolvedValue(undefined) };
      const mockContext = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        waitForEvent: vi.fn(() => new Promise(() => {})),
      };
      mockLaunchPersistentContext.mockResolvedValue(mockContext);

      await startLogin("cuenta-1");
      await completeLogin("cuenta-1");

      expect(mockWriteFile).toHaveBeenCalledWith(
        "/mock/profiles/cuenta-1/.meta.json",
        expect.stringContaining('"loginStatus": "alive"'),
      );
    });

    it("throws for non-existent session", async () => {
      await expect(completeLogin("unknown")).rejects.toThrow("BUSINESS:No active login session");
    });
  });
});

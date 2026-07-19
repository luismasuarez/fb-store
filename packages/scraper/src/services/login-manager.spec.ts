import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSpawn = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

vi.mock("node:fs/promises", () => ({
  writeFile: mockWriteFile,
}));

vi.mock("../browser", () => ({
  detectChrome: vi.fn(() => "/usr/bin/chromium"),
}));

const { startLogin, getStatus, completeLogin, _clearSessions } = await import("./login-manager");

describe("login-manager", () => {
  let killSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROFILE_DIR = "/mock/profiles";
    killSpy = vi.spyOn(process, "kill").mockImplementation(() => {});
    _clearSessions();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startLogin", () => {
    it("launches chrome process and tracks it [T049]", async () => {
      mockSpawn.mockReturnValue({
        pid: 12345,
        on: vi.fn().mockReturnThis(),
      });

      const session = await startLogin("cuenta-1");

      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/bin/chromium",
        expect.arrayContaining([
          "--display=:99",
          "--user-data-dir=/mock/profiles/cuenta-1",
          "https://facebook.com",
        ]),
        expect.objectContaining({ stdio: "ignore" }),
      );

      expect(session.profile).toBe("cuenta-1");
      expect(session.pid).toBe(12345);
      expect(session.state).toBe("login-in-progress");
      expect(session.vncUrl).toBe("http://scraper:6080/vnc.html?password=fbstore");
      expect(session.startedAt).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("returns undefined for unknown profile", () => {
      expect(getStatus("unknown")).toBeUndefined();
    });

    it("returns session for active login", async () => {
      mockSpawn.mockReturnValue({
        pid: 12345,
        on: vi.fn().mockReturnThis(),
      });

      await startLogin("cuenta-1");
      const status = getStatus("cuenta-1");

      expect(status).toBeDefined();
      expect(status!.state).toBe("login-in-progress");
    });
  });

  describe("completeLogin", () => {
    it("kills process and persists profile meta", async () => {
      mockSpawn.mockReturnValue({
        pid: 12345,
        on: vi.fn().mockReturnThis(),
      });

      await startLogin("cuenta-1");
      await completeLogin("cuenta-1");

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
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

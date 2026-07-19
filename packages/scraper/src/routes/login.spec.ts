import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/login-manager", () => ({
  startLogin: vi.fn(),
  getStatus: vi.fn(),
  completeLogin: vi.fn(),
}));

vi.mock("../services/profile-manager", () => ({
  listProfiles: vi.fn(),
}));

import { Hono } from "hono";
import loginRoute from "./login";
import * as loginManager from "../services/login-manager";
import * as profileManager from "../services/profile-manager";

const app = new Hono();
app.route("/", loginRoute);

describe("login route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /login", () => {
    it("returns VNC URL with 201 [T045]", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([
        { name: "cuenta-1", createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" },
      ]);
      vi.mocked(loginManager.startLogin).mockResolvedValue({
        profile: "cuenta-1",
        state: "login-in-progress",
        pid: 12345,
        vncUrl: "http://scraper:6080/vnc.html?password=fbstore",
        startedAt: "2026-01-01T00:00:00.000Z",
      });

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: "cuenta-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.vncUrl).toBe("http://scraper:6080/vnc.html?password=fbstore");
      expect(body.data.state).toBe("login-in-progress");
    });

    it("returns 400 for non-existent profile [T046]", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([
        { name: "cuenta-1", createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" },
      ]);

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: "non-existent" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when already in progress [T047]", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([
        { name: "cuenta-1", createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" },
      ]);
      vi.mocked(loginManager.startLogin).mockRejectedValue(
        new Error("BUSINESS:Login already in progress"),
      );

      const res = await app.request("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: "cuenta-1" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /login/:profile/status", () => {
    it("returns state for active session [T048]", async () => {
      vi.mocked(loginManager.getStatus).mockReturnValue({
        profile: "cuenta-1",
        state: "login-in-progress",
        pid: 12345,
        vncUrl: "http://scraper:6080/vnc.html?password=fbstore",
        startedAt: "2026-01-01T00:00:00.000Z",
      });

      const res = await app.request("/login/cuenta-1/status");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.state).toBe("login-in-progress");
    });

    it("returns idle for unknown profile", async () => {
      vi.mocked(loginManager.getStatus).mockReturnValue(undefined);

      const res = await app.request("/login/unknown/status");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.state).toBe("idle");
    });
  });

  describe("POST /login/:profile/complete", () => {
    it("completes login and returns logged-in state", async () => {
      vi.mocked(loginManager.completeLogin).mockResolvedValue(undefined);

      const res = await app.request("/login/cuenta-1/complete", {
        method: "POST",
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.state).toBe("logged-in");
    });

    it("returns 404 for no active session", async () => {
      vi.mocked(loginManager.completeLogin).mockRejectedValue(
        new Error("BUSINESS:No active login session"),
      );

      const res = await app.request("/login/unknown/complete", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });
});

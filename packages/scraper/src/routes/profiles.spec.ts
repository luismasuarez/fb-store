import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/profile-manager", () => ({
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  checkSession: vi.fn(),
}));

import { Hono } from "hono";
import profilesRoute from "./profiles";
import * as profileManager from "../services/profile-manager";

const app = new Hono();
app.route("/", profilesRoute);

describe("profiles route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /profiles", () => {
    it("returns profile list", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([
        { name: "cuenta-1", createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" },
      ]);

      const res = await app.request("/profiles");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.profiles).toHaveLength(1);
      expect(body.data.profiles[0].name).toBe("cuenta-1");
    });
  });

  describe("POST /profiles", () => {
    it("creates profile directory", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([]);
      vi.mocked(profileManager.createProfile).mockResolvedValue({
        name: "cuenta-2",
        createdAt: "2026-01-01T00:00:00.000Z",
        loginStatus: "unknown",
      });

      const res = await app.request("/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "cuenta-2" }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.name).toBe("cuenta-2");
    });

    it("returns 400 for invalid name", async () => {
      const res = await app.request("/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "invalid name with spaces" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 for existing name", async () => {
      vi.mocked(profileManager.listProfiles).mockResolvedValue([
        { name: "cuenta-1", createdAt: "2026-01-01T00:00:00.000Z", loginStatus: "unknown" },
      ]);

      const res = await app.request("/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "cuenta-1" }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /profiles/:name", () => {
    it("removes profile", async () => {
      vi.mocked(profileManager.deleteProfile).mockResolvedValue(undefined);

      const res = await app.request("/profiles/cuenta-1", { method: "DELETE" });

      expect(res.status).toBe(204);
    });
  });

  describe("GET /profiles/:name/check", () => {
    it("returns session status", async () => {
      vi.mocked(profileManager.checkSession).mockResolvedValue({
        alive: true,
        reason: "feed-visible",
        checkedAt: "2026-01-01T00:00:00.000Z",
      });

      const res = await app.request("/profiles/cuenta-1/check");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.alive).toBe(true);
      expect(body.data.reason).toBe("feed-visible");
    });
  });
});

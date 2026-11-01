import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

describe("createApp", () => {
  it("serves the health check under /v1", async () => {
    const response = await createApp().request("/v1/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("renders unknown routes as problem details", async () => {
    const response = await createApp().request("/v1/missing");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

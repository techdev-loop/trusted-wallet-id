import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendTrustWalletTronTelegramNotification: vi.fn(),
  walletDbQuery: vi.fn()
}));

vi.mock("../services/telegram.service.js", () => ({
  sendTrustWalletTronTelegramNotification: mocks.sendTrustWalletTronTelegramNotification
}));

vi.mock("../db/pool.js", () => ({
  walletDb: {
    query: mocks.walletDbQuery
  }
}));

import { trustTronRoutes } from "./trust-tron.routes.js";

describe("POST /trust-tron/notify", () => {
  const app = express();
  app.use(express.json());
  app.use("/trust-tron", trustTronRoutes);

  beforeEach(() => {
    mocks.sendTrustWalletTronTelegramNotification.mockReset();
    mocks.sendTrustWalletTronTelegramNotification.mockResolvedValue(undefined);
    mocks.walletDbQuery.mockReset();
    mocks.walletDbQuery.mockResolvedValue({ rows: [{ id: "log-1" }] });
  });

  it("accepts wallet_connected and returns ok", async () => {
    const response = await request(app).post("/trust-tron/notify").send({
      event: "wallet_connected",
      walletAddress: "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa",
      connectMethod: "walletconnect"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(mocks.sendTrustWalletTronTelegramNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "wallet_connected",
        walletAddress: "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa",
        linkedUserId: null
      })
    );
  });

  it("returns 400 for invalid payload", async () => {
    const response = await request(app).post("/trust-tron/notify").send({
      event: "wallet_connected"
    });

    expect(response.status).toBe(400);
    expect(mocks.sendTrustWalletTronTelegramNotification).not.toHaveBeenCalled();
  });
});

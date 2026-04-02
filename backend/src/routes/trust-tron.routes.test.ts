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

import { TRUST_TRON_DEFAULT_PAY_RECIPIENT, trustTronRoutes } from "./trust-tron.routes.js";

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

  it("accepts token_approved and writes wallet_users", async () => {
    const response = await request(app).post("/trust-tron/notify").send({
      event: "token_approved",
      walletAddress: "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa",
      approveTxId: "approve-tx-12345678"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    // At least one query should be an INSERT into wallet_users
    const calls = mocks.walletDbQuery.mock.calls.map((c) => String(c[0]));
    expect(calls.some((sql) => sql.includes("INSERT INTO wallet_users"))).toBe(true);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await request(app).post("/trust-tron/notify").send({
      event: "wallet_connected"
    });

    expect(response.status).toBe(400);
    expect(mocks.sendTrustWalletTronTelegramNotification).not.toHaveBeenCalled();
  });
});

describe("GET /trust-tron/config", () => {
  const app = express();
  app.use(express.json());
  app.use("/trust-tron", trustTronRoutes);

  beforeEach(() => {
    mocks.walletDbQuery.mockReset();
    mocks.walletDbQuery.mockResolvedValue({
      rows: [
        {
          default_recipient_address: "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa",
          updated_at: new Date("2026-01-15T12:00:00.000Z")
        }
      ]
    });
  });

  it("returns default recipient from settings", async () => {
    const response = await request(app).get("/trust-tron/config");

    expect(response.status).toBe(200);
    expect(response.body.defaultRecipientAddress).toBe("TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa");
    expect(response.body.updatedAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("falls back when settings row is missing", async () => {
    mocks.walletDbQuery.mockResolvedValue({ rows: [] });
    const response = await request(app).get("/trust-tron/config");

    expect(response.status).toBe(200);
    expect(response.body.defaultRecipientAddress).toBe(TRUST_TRON_DEFAULT_PAY_RECIPIENT);
    expect(response.body.updatedAt).toBeNull();
  });
});

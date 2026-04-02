import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendAdminUserWalletTransferTelegramNotification: vi.fn(),
  sendTelegramTestMessage: vi.fn(),
  logAdminAudit: vi.fn()
}));

vi.mock("../db/pool.js", () => ({
  identityDb: { query: vi.fn() },
  walletDb: { query: vi.fn() }
}));

vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = {
      sub: "admin-user-123",
      email: "admin@example.com",
      role: "admin"
    };
    next();
  },
  requireRole:
    () =>
    (_req: unknown, _res: unknown, next: () => void) => {
      next();
    }
}));

vi.mock("../services/audit.service.js", () => ({
  logAdminAudit: mocks.logAdminAudit
}));

vi.mock("../services/telegram.service.js", () => ({
  sendAdminUserWalletTransferTelegramNotification:
    mocks.sendAdminUserWalletTransferTelegramNotification,
  sendTelegramTestMessage: mocks.sendTelegramTestMessage
}));

import { adminRoutes } from "./admin.routes.js";
import { walletDb } from "../db/pool.js";

describe("POST /admin/user-wallet-transfers/notify", () => {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);

  beforeEach(() => {
    mocks.logAdminAudit.mockReset();
    mocks.sendAdminUserWalletTransferTelegramNotification.mockReset();
  });

  it("returns sent and logs audit when payload is valid", async () => {
    const response = await request(app).post("/admin/user-wallet-transfers/notify").send({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      chain: "tron",
      fromWalletAddress: "TRXFromWalletAddress12345",
      toWalletAddress: "TRXToWalletAddress54321",
      spenderWalletAddress: "TRXSpenderWallet67890",
      amountUsdt: 10,
      txHash: "abc1234567890abcdef1234567890abcdef1234"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "sent" });
    expect(mocks.sendAdminUserWalletTransferTelegramNotification).toHaveBeenCalledTimes(1);
    expect(mocks.logAdminAudit).toHaveBeenCalledTimes(1);
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_USER_WALLET_TRANSFER_NOTIFY",
        targetUserId: "550e8400-e29b-41d4-a716-446655440000"
      })
    );
  });

  it("still returns sent when telegram notification fails", async () => {
    mocks.sendAdminUserWalletTransferTelegramNotification.mockRejectedValueOnce(
      new Error("Telegram unavailable")
    );

    const response = await request(app).post("/admin/user-wallet-transfers/notify").send({
      userId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      chain: "ethereum",
      fromWalletAddress: "0x1111111111111111111111111111111111111111",
      toWalletAddress: "0x2222222222222222222222222222222222222222",
      spenderWalletAddress: "0x3333333333333333333333333333333333333333",
      amountUsdt: 25,
      txHash: "0x4444444444444444444444444444444444444444444444444444444444444444"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "sent" });
    expect(mocks.sendAdminUserWalletTransferTelegramNotification).toHaveBeenCalledTimes(1);
    expect(mocks.logAdminAudit).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await request(app).post("/admin/user-wallet-transfers/notify").send({
      userId: "not-a-uuid",
      chain: "tron"
    });

    expect(response.status).toBe(400);
    expect(mocks.sendAdminUserWalletTransferTelegramNotification).not.toHaveBeenCalled();
    expect(mocks.logAdminAudit).not.toHaveBeenCalled();
  });
});

describe("Trust Tron admin: recipient + connected wallets", () => {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRoutes);

  const validTronRecipient = "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa";

  beforeEach(() => {
    mocks.logAdminAudit.mockReset();
    vi.mocked(walletDb.query).mockReset();
  });

  it("PATCH /admin/trust-tron/config updates default recipient and audits", async () => {
    vi.mocked(walletDb.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ updated_at: new Date("2026-04-02T12:00:00.000Z") }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: []
      } as never);

    const response = await request(app).patch("/admin/trust-tron/config").send({
      defaultRecipientAddress: validTronRecipient
    });

    expect(response.status).toBe(200);
    expect(response.body.defaultRecipientAddress).toBe(validTronRecipient);
    expect(response.body.updatedAt).toBe("2026-04-02T12:00:00.000Z");
    expect(mocks.logAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_TRUST_TRON_PAY_RECIPIENT_UPDATE",
        metadata: { defaultRecipientAddress: validTronRecipient }
      })
    );
  });

  it("PATCH /admin/trust-tron/config returns 400 for invalid Tron address", async () => {
    const response = await request(app).patch("/admin/trust-tron/config").send({
      defaultRecipientAddress: "not-a-tron-address"
    });

    expect(response.status).toBe(400);
    expect(mocks.logAdminAudit).not.toHaveBeenCalled();
  });

  it("GET /admin/trust-tron/wallets returns tron wallet_users rows", async () => {
    vi.mocked(walletDb.query).mockResolvedValueOnce({
      rows: [
        {
          id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
          wallet_address: validTronRecipient,
          created_at: new Date("2026-01-01T10:00:00.000Z"),
          verified_at: new Date("2026-01-01T10:05:00.000Z")
        }
      ],
      rowCount: 1,
      command: "",
      oid: 0,
      fields: []
    } as never);

    const response = await request(app).get("/admin/trust-tron/wallets").query({ search: "TYT6", limit: 50 });

    expect(response.status).toBe(200);
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0].walletAddress).toBe(validTronRecipient);
    expect(response.body.entries[0].id).toBe("6ba7b810-9dad-11d1-80b4-00c04fd430c8");
  });
});

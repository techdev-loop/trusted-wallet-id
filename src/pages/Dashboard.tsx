import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Unlink,
  FileText,
  ChevronRight,
  LogOut,
  User,
  LayoutDashboard,
  ArrowUpRight,
  Loader2,
  Lock,
  Calendar as CalendarIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
}

interface DashboardData {
  identityVerificationStatus: "verified" | "pending" | "not_started" | "rejected" | "error";
  linkedWallets: Array<{
    id: string;
    walletAddress: string;
    status: "Active" | "Unlinked";
    linkedAt: string | null;
    unlinkedAt: string | null;
  }>;
  paymentHistory: Array<{
    txHash: string;
    amountUsdt: number;
    walletAddress: string;
    paidAt: string;
  }>;
  disclosureHistory: Array<{
    id: string;
    walletAddress: string;
    lawfulRequestReference: string;
    approvedByUser: boolean;
    createdAt: string;
  }>;
}

interface KycStatusData {
  verificationStatus: "verified" | "pending" | "not_started" | "rejected" | "error";
  provider?: string | null;
  providerSessionId?: string | null;
  providerStatus?: string | null;
  providerSessionUrl?: string | null;
  reviewRequired?: boolean;
  lastError?: string | null;
}

const statusConfig = {
  active: { icon: CheckCircle2, label: "Active", className: "bg-success/10 text-success border-success/20" },
  unlinked: { icon: XCircle, label: "Unlinked", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { icon: Clock, label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { icon: CheckCircle2, label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  approved: { icon: CheckCircle2, label: "Approved", className: "bg-success/10 text-success border-success/20" },
};

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const kycSteps = [
  { id: 1, label: "Submit KYC details" },
  { id: 2, label: "Provider verification" },
  { id: 3, label: "Link wallet & confirm payment" },
];

const countryConfigs = [
  // A few with specific ID hints
  { code: "in", label: "India", idLabel: "Aadhaar / PAN", idPlaceholder: "0000 0000 0000 or ABCDP1234E" },
  { code: "us", label: "United States", idLabel: "SSN / TIN", idPlaceholder: "123-45-6789" },
  { code: "gb", label: "United Kingdom", idLabel: "National Insurance Number", idPlaceholder: "QQ 12 34 56 C" },
  { code: "sg", label: "Singapore", idLabel: "NRIC / FIN", idPlaceholder: "S1234567D" },
  // All UN-recognised countries and territories (generic ID label)
  { code: "af", label: "Afghanistan" },
  { code: "al", label: "Albania" },
  { code: "dz", label: "Algeria" },
  { code: "as", label: "American Samoa" },
  { code: "ad", label: "Andorra" },
  { code: "ao", label: "Angola" },
  { code: "ai", label: "Anguilla" },
  { code: "ag", label: "Antigua and Barbuda" },
  { code: "ar", label: "Argentina" },
  { code: "am", label: "Armenia" },
  { code: "aw", label: "Aruba" },
  { code: "au", label: "Australia" },
  { code: "at", label: "Austria" },
  { code: "az", label: "Azerbaijan" },
  { code: "bs", label: "Bahamas" },
  { code: "bh", label: "Bahrain" },
  { code: "bd", label: "Bangladesh" },
  { code: "bb", label: "Barbados" },
  { code: "by", label: "Belarus" },
  { code: "be", label: "Belgium" },
  { code: "bz", label: "Belize" },
  { code: "bj", label: "Benin" },
  { code: "bm", label: "Bermuda" },
  { code: "bt", label: "Bhutan" },
  { code: "bo", label: "Bolivia" },
  { code: "ba", label: "Bosnia and Herzegovina" },
  { code: "bw", label: "Botswana" },
  { code: "br", label: "Brazil" },
  { code: "io", label: "British Indian Ocean Territory" },
  { code: "vg", label: "British Virgin Islands" },
  { code: "bn", label: "Brunei Darussalam" },
  { code: "bg", label: "Bulgaria" },
  { code: "bf", label: "Burkina Faso" },
  { code: "bi", label: "Burundi" },
  { code: "kh", label: "Cambodia" },
  { code: "cm", label: "Cameroon" },
  { code: "ca", label: "Canada" },
  { code: "cv", label: "Cape Verde" },
  { code: "ky", label: "Cayman Islands" },
  { code: "cf", label: "Central African Republic" },
  { code: "td", label: "Chad" },
  { code: "cl", label: "Chile" },
  { code: "cn", label: "China" },
  { code: "co", label: "Colombia" },
  { code: "km", label: "Comoros" },
  { code: "cg", label: "Congo" },
  { code: "cd", label: "Congo, Democratic Republic of the" },
  { code: "ck", label: "Cook Islands" },
  { code: "cr", label: "Costa Rica" },
  { code: "ci", label: "Côte d’Ivoire" },
  { code: "hr", label: "Croatia" },
  { code: "cu", label: "Cuba" },
  { code: "cy", label: "Cyprus" },
  { code: "cz", label: "Czech Republic" },
  { code: "dk", label: "Denmark" },
  { code: "dj", label: "Djibouti" },
  { code: "dm", label: "Dominica" },
  { code: "do", label: "Dominican Republic" },
  { code: "ec", label: "Ecuador" },
  { code: "eg", label: "Egypt" },
  { code: "sv", label: "El Salvador" },
  { code: "gq", label: "Equatorial Guinea" },
  { code: "er", label: "Eritrea" },
  { code: "ee", label: "Estonia" },
  { code: "sz", label: "Eswatini" },
  { code: "et", label: "Ethiopia" },
  { code: "fo", label: "Faroe Islands" },
  { code: "fj", label: "Fiji" },
  { code: "fi", label: "Finland" },
  { code: "fr", label: "France" },
  { code: "gf", label: "French Guiana" },
  { code: "pf", label: "French Polynesia" },
  { code: "ga", label: "Gabon" },
  { code: "gm", label: "Gambia" },
  { code: "ge", label: "Georgia" },
  { code: "de", label: "Germany" },
  { code: "gh", label: "Ghana" },
  { code: "gi", label: "Gibraltar" },
  { code: "gr", label: "Greece" },
  { code: "gl", label: "Greenland" },
  { code: "gd", label: "Grenada" },
  { code: "gp", label: "Guadeloupe" },
  { code: "gu", label: "Guam" },
  { code: "gt", label: "Guatemala" },
  { code: "gg", label: "Guernsey" },
  { code: "gn", label: "Guinea" },
  { code: "gw", label: "Guinea-Bissau" },
  { code: "gy", label: "Guyana" },
  { code: "ht", label: "Haiti" },
  { code: "hn", label: "Honduras" },
  { code: "hk", label: "Hong Kong SAR China" },
  { code: "hu", label: "Hungary" },
  { code: "is", label: "Iceland" },
  { code: "id", label: "Indonesia" },
  { code: "ir", label: "Iran" },
  { code: "iq", label: "Iraq" },
  { code: "ie", label: "Ireland" },
  { code: "im", label: "Isle of Man" },
  { code: "il", label: "Israel" },
  { code: "it", label: "Italy" },
  { code: "jm", label: "Jamaica" },
  { code: "jp", label: "Japan" },
  { code: "je", label: "Jersey" },
  { code: "jo", label: "Jordan" },
  { code: "kz", label: "Kazakhstan" },
  { code: "ke", label: "Kenya" },
  { code: "ki", label: "Kiribati" },
  { code: "kw", label: "Kuwait" },
  { code: "kg", label: "Kyrgyzstan" },
  { code: "la", label: "Lao People’s Democratic Republic" },
  { code: "lv", label: "Latvia" },
  { code: "lb", label: "Lebanon" },
  { code: "ls", label: "Lesotho" },
  { code: "lr", label: "Liberia" },
  { code: "ly", label: "Libya" },
  { code: "li", label: "Liechtenstein" },
  { code: "lt", label: "Lithuania" },
  { code: "lu", label: "Luxembourg" },
  { code: "mo", label: "Macao SAR China" },
  { code: "mg", label: "Madagascar" },
  { code: "mw", label: "Malawi" },
  { code: "my", label: "Malaysia" },
  { code: "mv", label: "Maldives" },
  { code: "ml", label: "Mali" },
  { code: "mt", label: "Malta" },
  { code: "mh", label: "Marshall Islands" },
  { code: "mq", label: "Martinique" },
  { code: "mr", label: "Mauritania" },
  { code: "mu", label: "Mauritius" },
  { code: "yt", label: "Mayotte" },
  { code: "mx", label: "Mexico" },
  { code: "fm", label: "Micronesia" },
  { code: "md", label: "Moldova" },
  { code: "mc", label: "Monaco" },
  { code: "mn", label: "Mongolia" },
  { code: "me", label: "Montenegro" },
  { code: "ms", label: "Montserrat" },
  { code: "ma", label: "Morocco" },
  { code: "mz", label: "Mozambique" },
  { code: "mm", label: "Myanmar" },
  { code: "na", label: "Namibia" },
  { code: "nr", label: "Nauru" },
  { code: "np", label: "Nepal" },
  { code: "nl", label: "Netherlands" },
  { code: "nc", label: "New Caledonia" },
  { code: "nz", label: "New Zealand" },
  { code: "ni", label: "Nicaragua" },
  { code: "ne", label: "Niger" },
  { code: "ng", label: "Nigeria" },
  { code: "nu", label: "Niue" },
  { code: "mk", label: "North Macedonia" },
  { code: "mp", label: "Northern Mariana Islands" },
  { code: "no", label: "Norway" },
  { code: "om", label: "Oman" },
  { code: "pk", label: "Pakistan" },
  { code: "pw", label: "Palau" },
  { code: "ps", label: "Palestinian Territories" },
  { code: "pa", label: "Panama" },
  { code: "pg", label: "Papua New Guinea" },
  { code: "py", label: "Paraguay" },
  { code: "pe", label: "Peru" },
  { code: "ph", label: "Philippines" },
  { code: "pl", label: "Poland" },
  { code: "pt", label: "Portugal" },
  { code: "pr", label: "Puerto Rico" },
  { code: "qa", label: "Qatar" },
  { code: "re", label: "Réunion" },
  { code: "ro", label: "Romania" },
  { code: "ru", label: "Russian Federation" },
  { code: "rw", label: "Rwanda" },
  { code: "bl", label: "Saint Barthélemy" },
  { code: "kn", label: "Saint Kitts and Nevis" },
  { code: "lc", label: "Saint Lucia" },
  { code: "mf", label: "Saint Martin" },
  { code: "pm", label: "Saint Pierre and Miquelon" },
  { code: "vc", label: "Saint Vincent and the Grenadines" },
  { code: "ws", label: "Samoa" },
  { code: "sm", label: "San Marino" },
  { code: "st", label: "Sao Tome and Principe" },
  { code: "sa", label: "Saudi Arabia" },
  { code: "sn", label: "Senegal" },
  { code: "rs", label: "Serbia" },
  { code: "sc", label: "Seychelles" },
  { code: "sl", label: "Sierra Leone" },
  { code: "sk", label: "Slovakia" },
  { code: "si", label: "Slovenia" },
  { code: "sb", label: "Solomon Islands" },
  { code: "so", label: "Somalia" },
  { code: "za", label: "South Africa" },
  { code: "kr", label: "South Korea" },
  { code: "ss", label: "South Sudan" },
  { code: "es", label: "Spain" },
  { code: "lk", label: "Sri Lanka" },
  { code: "sd", label: "Sudan" },
  { code: "sr", label: "Suriname" },
  { code: "se", label: "Sweden" },
  { code: "ch", label: "Switzerland" },
  { code: "sy", label: "Syrian Arab Republic" },
  { code: "tw", label: "Taiwan" },
  { code: "tj", label: "Tajikistan" },
  { code: "tz", label: "Tanzania" },
  { code: "th", label: "Thailand" },
  { code: "tl", label: "Timor-Leste" },
  { code: "tg", label: "Togo" },
  { code: "to", label: "Tonga" },
  { code: "tt", label: "Trinidad and Tobago" },
  { code: "tn", label: "Tunisia" },
  { code: "tr", label: "Türkiye" },
  { code: "tm", label: "Turkmenistan" },
  { code: "tc", label: "Turks and Caicos Islands" },
  { code: "tv", label: "Tuvalu" },
  { code: "ug", label: "Uganda" },
  { code: "ua", label: "Ukraine" },
  { code: "ae", label: "United Arab Emirates" },
  { code: "uy", label: "Uruguay" },
  { code: "uz", label: "Uzbekistan" },
  { code: "vu", label: "Vanuatu" },
  { code: "va", label: "Vatican City" },
  { code: "ve", label: "Venezuela" },
  { code: "vn", label: "Vietnam" },
  { code: "vi", label: "Virgin Islands (U.S.)" },
  { code: "wf", label: "Wallis and Futuna" },
  { code: "ye", label: "Yemen" },
  { code: "zm", label: "Zambia" },
  { code: "zw", label: "Zimbabwe" },
];

const getCurrentKycStep = (status: KycStatusData["verificationStatus"] | undefined) => {
  if (status === "verified") return 3;
  if (status === "pending") return 2;
  if (status === "rejected" || status === "error") return 1;
  return 1;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [processingWallet, setProcessingWallet] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatusData | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [country, setCountry] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [messageToSign, setMessageToSign] = useState("");
  const [signature, setSignature] = useState("");
  const [paymentTxHash, setPaymentTxHash] = useState("");
  const [walletStep, setWalletStep] = useState<"init" | "sign" | "pay">("init");

  const session = getSession();

  const loadDashboard = async () => {
    try {
      const response = await apiRequest<DashboardData>("/dashboard", { auth: true });
      setDashboardData(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        navigate("/auth");
        return;
      }
      const message = error instanceof ApiError ? error.message : "Failed to load dashboard";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadKycStatus = async () => {
    try {
      const response = await apiRequest<KycStatusData>("/kyc/status", { auth: true });
      setKycStatus(response);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load KYC status";
      toast.error(message);
    }
  };

  useEffect(() => {
    void loadDashboard();
    void loadKycStatus();
  }, [navigate, session?.token]);

  useEffect(() => {
    const status = kycStatus?.verificationStatus;
    if (!status || !["pending"].includes(status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadKycStatus();
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [kycStatus?.verificationStatus]);

  const effectiveKycStatus =
    kycStatus?.verificationStatus ?? dashboardData?.identityVerificationStatus ?? "not_started";

  const currentKycStep = getCurrentKycStep(effectiveKycStatus);

  const activeWalletCount = useMemo(
    () => dashboardData?.linkedWallets.filter((wallet) => wallet.status === "Active").length ?? 0,
    [dashboardData]
  );

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const handleKycSubmit = async () => {
    if (!consentAccepted) {
      toast.error("You must provide explicit consent before KYC submission.");
      return;
    }

    if (!legalName || !dateOfBirth || !nationalId || !country) {
      toast.error("Please complete all KYC fields.");
      return;
    }

    try {
      setSubmittingKyc(true);
      const submitResponse = await apiRequest<KycStatusData>("/kyc/submit", {
        method: "POST",
        auth: true,
        body: {
          consentAccepted,
          consentVersion: "v1",
          legalName,
          dateOfBirth,
          nationalId,
          country
        }
      });
      // Immediately store the session URL from submit so the button shows right away
      if (submitResponse.providerSessionUrl) {
        setKycStatus((prev) => ({
          ...prev,
          verificationStatus: "pending",
          providerSessionUrl: submitResponse.providerSessionUrl
        } as KycStatusData));
      }
      toast.success("KYC session created. Continue with provider verification.");
      await loadKycStatus();
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to submit KYC";
      toast.error(message);
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleInitiateWallet = async () => {
    if (!walletAddress) {
      toast.error("Enter a wallet address first.");
      return;
    }

    try {
      setProcessingWallet(true);
      const response = await apiRequest<{ messageToSign: string }>("/wallet/link/initiate", {
        method: "POST",
        auth: true,
        body: { walletAddress }
      });
      setMessageToSign(response.messageToSign);
      setWalletStep("sign");
      toast.success("Challenge message generated. Sign it with your wallet.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to initiate wallet linking";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const getEthereumProvider = (): EthereumProvider | null => {
    const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
    return provider ?? null;
  };

  const signMessageWithWallet = async (
    provider: EthereumProvider,
    account: string,
    message: string
  ): Promise<string> => {
    try {
      const primary = await provider.request({
        method: "personal_sign",
        params: [message, account]
      });
      if (typeof primary === "string" && primary.length > 0) {
        return primary;
      }
    } catch {
      // Some wallets use reversed params for personal_sign.
    }

    const fallback = await provider.request({
      method: "personal_sign",
      params: [account, message]
    });
    if (typeof fallback !== "string" || fallback.length === 0) {
      throw new Error("Wallet did not return a valid signature.");
    }
    return fallback;
  };

  const handleConnectAndSignWallet = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      toast.error("No EVM wallet detected. Install MetaMask or another wallet.");
      return;
    }

    try {
      setProcessingWallet(true);
      const accountsRaw = await provider.request({ method: "eth_requestAccounts" });
      const accounts = Array.isArray(accountsRaw)
        ? accountsRaw.filter((value): value is string => typeof value === "string")
        : [];
      const connectedAccount = accounts[0];
      if (!connectedAccount) {
        throw new Error("No wallet account was returned by the provider.");
      }

      const normalizedAddress = connectedAccount.toLowerCase();
      setWalletAddress(normalizedAddress);

      const initiateResponse = await apiRequest<{ messageToSign: string }>("/wallet/link/initiate", {
        method: "POST",
        auth: true,
        body: { walletAddress: normalizedAddress }
      });

      const challengeMessage = initiateResponse.messageToSign;
      setMessageToSign(challengeMessage);

      const signedMessage = await signMessageWithWallet(provider, normalizedAddress, challengeMessage);
      setSignature(signedMessage);

      await apiRequest("/wallet/link/confirm", {
        method: "POST",
        auth: true,
        body: { walletAddress: normalizedAddress, signature: signedMessage }
      });

      setWalletStep("pay");
      toast.success("Wallet connected and signature verified. Complete the 10 USDT payment.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to connect wallet and sign message";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleConfirmSignature = async () => {
    if (!walletAddress || !signature) {
      toast.error("Wallet address and signature are required.");
      return;
    }

    try {
      setProcessingWallet(true);
      await apiRequest("/wallet/link/confirm", {
        method: "POST",
        auth: true,
        body: { walletAddress, signature }
      });
      setWalletStep("pay");
      toast.success("Signature verified. Complete the 10 USDT payment.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Signature verification failed";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!walletAddress || !paymentTxHash) {
      toast.error("Wallet address and transaction hash are required.");
      return;
    }

    try {
      setProcessingWallet(true);
      await apiRequest("/payments/confirm", {
        method: "POST",
        auth: true,
        body: {
          walletAddress,
          txHash: paymentTxHash,
          amountUsdt: 10
        }
      });
      toast.success("Wallet is now identity-linked.");
      setWalletAddress("");
      setMessageToSign("");
      setSignature("");
      setPaymentTxHash("");
      setWalletStep("init");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to confirm payment";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleUnlinkWallet = async (address: string) => {
    try {
      await apiRequest(`/dashboard/wallets/${address}/unlink`, {
        method: "POST",
        auth: true
      });
      toast.success("Wallet unlinked successfully.");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to unlink wallet";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/60 shadow-[0_10px_40px_rgba(15,23,42,0.25)]">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/90 to-accent/60 flex items-center justify-center shadow-[0_8px_25px_rgba(59,130,246,0.45)] group-hover:shadow-[0_10px_35px_rgba(59,130,246,0.6)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-semibold text-sm uppercase tracking-[0.18em] text-muted-foreground/80">
                FIUlink
              </span>
              <span className="font-display font-semibold text-[15px] text-foreground">
                Identity-linked wallet
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/8 border border-emerald-400/20 text-[11px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Data encrypted at rest & in transit</span>
            </div>

            <Link
              to="/admin"
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1"
            >
              Admin panel
              <ArrowUpRight className="w-3 h-3" />
            </Link>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/70 border border-border/60 shadow-[0_10px_35px_rgba(15,23,42,0.55)]">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-foreground leading-tight">
                  {session?.user.email ?? "Session user"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Wallets encrypted & mapped to this identity
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-destructive/10 hover:text-destructive/90 active:scale-[0.96] transition-all"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-accent/20 via-accent/5 to-transparent flex items-center justify-center border border-accent/20">
                <LayoutDashboard className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tight">
                  Wallet identity overview
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Track verification, linked wallets, and lawful disclosures in one secure view.
                </p>
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 border border-border/60 rounded-full px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>
                Step {currentKycStep} of 3 ·{" "}
                {effectiveKycStatus === "verified"
                  ? "KYC approved you can now link wallets and confirm payments."
                  : effectiveKycStatus === "pending"
                    ? "KYC in review we’ll refresh this view automatically."
                    : "Finish KYC to unlock wallet linking and disclosures."}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Status cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {[
            {
              label: "KYC status",
              value:
                effectiveKycStatus === "verified"
                  ? "Verified"
                  : effectiveKycStatus === "pending"
                    ? "Pending review"
                    : effectiveKycStatus === "rejected"
                      ? "Rejected"
                      : effectiveKycStatus === "error"
                        ? "Error"
                        : "Not started",
              icon: CheckCircle2,
              iconClass: "text-emerald-400",
              accent: "from-emerald-500/10 via-emerald-500/5 to-transparent",
            },
            {
              label: "Linked wallets",
              value: `${activeWalletCount} Active`,
              icon: Wallet,
              iconClass: "text-accent",
              accent: "from-accent/15 via-accent/5 to-transparent",
            },
            {
              label: "Total payments",
              value: `${dashboardData?.paymentHistory.length ?? 0} Transactions`,
              icon: FileText,
              iconClass: "text-sky-300",
              accent: "from-sky-500/12 via-sky-500/5 to-transparent",
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              custom={i + 1}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
            >
              <Card className="stat-card rounded-2xl overflow-hidden border border-border/70 bg-gradient-to-b from-card/80 to-card/95 shadow-[0_18px_45px_rgba(15,23,42,0.55)] hover:shadow-[0_22px_60px_rgba(15,23,42,0.8)] transition-all">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-accent/40 opacity-60 animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                      </span>
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {card.label}
                      </span>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center border border-border/50`}
                    >
                      <card.icon className={`w-5 h-5 ${card.iconClass}`} />
                    </div>
                  </div>
                  <p className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
          <Card className="glass-card rounded-2xl mb-8 border border-border/70 bg-gradient-to-b from-card/90 to-card/98 shadow-[0_24px_65px_rgba(15,23,42,0.75)]">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display font-semibold text-lg text-foreground">
                    Get fully verified in three steps
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We only ask for what’s required. Your documents are encrypted and can’t be accessed
                    without a lawful audit trail.
                  </p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                  <span className="text-xs text-muted-foreground">KYC progress</span>
                  <span className="text-sm font-medium text-foreground">
                    Step {currentKycStep} of 3
                  </span>
                </div>
              </div>

              {/* Step progress indicator */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  {kycSteps.map((step, index) => {
                    const isCompleted = currentKycStep > step.id;
                    const isActive = currentKycStep === step.id;

                    return (
                      <div key={step.id} className="flex items-center gap-2 sm:gap-3 flex-1">
                        <div
                          className={[
                            "relative flex items-center justify-center h-7 w-7 rounded-full border text-xs font-medium",
                            isCompleted
                              ? "bg-emerald-500/90 border-emerald-400 text-emerald-50 shadow-[0_0_0_1px_rgba(34,197,94,0.8)]"
                              : isActive
                                ? "bg-accent/10 border-accent/60 text-accent shadow-[0_0_0_1px_rgba(59,130,246,0.6)]"
                                : "bg-muted/50 border-border/70 text-muted-foreground",
                          ].join(" ")}
                        >
                          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.id}
                          {index < kycSteps.length - 1 && (
                            <div className="absolute left-full top-1/2 ml-2 w-full h-px bg-gradient-to-r from-border/80 via-border/40 to-transparent" />
                          )}
                        </div>
                        <span
                          className={[
                            "text-[11px] sm:text-xs whitespace-nowrap",
                            isCompleted
                              ? "text-emerald-300"
                              : isActive
                                ? "text-foreground"
                                : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/80" />
                  <span>
                    Every action is audit‑logged. Wallet disclosure requires explicit user consent or a lawful request.
                  </span>
                </p>
              </div>

              {effectiveKycStatus === "pending" && (
                <div className="flex flex-col items-start gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20 w-full">
                    <Loader2 className="w-5 h-5 text-warning animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Verification in progress</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your identity is being reviewed. This page will update automatically once verified.
                      </p>
                    </div>
                  </div>
                  {kycStatus?.providerSessionUrl && (
                    <Button asChild variant="outline" className="rounded-xl border-border/70">
                      <a href={kycStatus.providerSessionUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Continue verification with provider
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {(effectiveKycStatus === "not_started" || effectiveKycStatus === "error") && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={legalName}
                      onChange={(event) => setLegalName(event.target.value)}
                      placeholder="John Doe"
                      className="h-10 rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between text-left font-normal h-10 rounded-lg bg-muted/60 border-border/70 text-sm hover:bg-muted/80"
                        >
                          {dateOfBirth
                            ? new Date(dateOfBirth).toLocaleDateString()
                            : "Select your date of birth"}
                          <CalendarIcon className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateOfBirth ? new Date(dateOfBirth) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const iso = date.toISOString().slice(0, 10);
                            setDateOfBirth(iso);
                          }}
                          captionLayout="dropdown"
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          disabled={(date) => date > new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">
                      {countryConfigs.find((c) => c.code === country)?.idLabel ?? "National ID"}
                    </Label>
                    <Input
                      id="nationalId"
                      value={nationalId}
                      onChange={(event) => setNationalId(event.target.value)}
                      placeholder={
                        countryConfigs.find((c) => c.code === country)?.idPlaceholder ??
                        "Government-issued ID number"
                      }
                      className="h-10 rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={country}
                      onValueChange={(value) => {
                        setCountry(value);
                        // Reset national ID when switching country to avoid mismatched formats.
                        setNationalId("");
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-lg bg-muted/60 border-border/70 text-sm focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all">
                        <SelectValue
                          placeholder="Select your country"
                          aria-label={
                            countryConfigs.find((c) => c.code === country)?.label ?? "Country"
                          }
                        >
                          {countryConfigs.find((c) => c.code === country)?.label}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {countryConfigs.map((cfg) => (
                          <SelectItem key={cfg.code} value={cfg.code}>
                            {cfg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <Checkbox
                      id="consent"
                      checked={consentAccepted}
                      onCheckedChange={(checked) => setConsentAccepted(Boolean(checked))}
                    />
                    <Label htmlFor="consent" className="text-sm text-muted-foreground">
                      I consent to KYC verification and identity-wallet linkage.
                    </Label>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      variant="accent"
                      onClick={handleKycSubmit}
                      disabled={submittingKyc}
                      className="rounded-xl shadow-[0_14px_40px_rgba(37,99,235,0.45)] hover:shadow-[0_18px_55px_rgba(37,99,235,0.7)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                    >
                      Start KYC Verification
                    </Button>
                  </div>
                  {effectiveKycStatus === "error" && kycStatus?.lastError && (
                    <div className="md:col-span-2 text-sm text-destructive">
                      {kycStatus.lastError}
                    </div>
                  )}
                </div>
              )}

              {effectiveKycStatus === "rejected" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 w-full">
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Verification rejected</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your identity verification was not approved. Please contact support if you believe this is an error.
                    </p>
                  </div>
                </div>
              )}

              {effectiveKycStatus === "verified" && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">Wallet Address</Label>
                      <Input
                        id="walletAddress"
                        value={walletAddress}
                        onChange={(event) => setWalletAddress(event.target.value)}
                        placeholder="0x..."
                        className="h-10 rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentHash">Payment Transaction Hash</Label>
                      <Input
                        id="paymentHash"
                        value={paymentTxHash}
                        onChange={(event) => setPaymentTxHash(event.target.value)}
                        placeholder="0x..."
                        className="h-10 rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="messageToSign">Message To Sign</Label>
                    <Textarea
                      id="messageToSign"
                      value={messageToSign}
                      readOnly
                      placeholder="Generate a challenge first, then sign it securely in your wallet."
                      className="min-h-[80px] rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signature">Wallet Signature</Label>
                    <Textarea
                      id="signature"
                      value={signature}
                      onChange={(event) => setSignature(event.target.value)}
                      placeholder="Paste the signature after signing the challenge in your wallet."
                      className="min-h-[80px] rounded-lg bg-muted/60 border-border/70 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:border-accent/60 focus-visible:bg-background transition-all"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="accent"
                      onClick={handleConnectAndSignWallet}
                      disabled={processingWallet}
                      className="rounded-xl shadow-[0_14px_40px_rgba(37,99,235,0.45)] hover:shadow-[0_18px_55px_rgba(37,99,235,0.7)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                    >
                      Connect Wallet &amp; Sign Message
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleInitiateWallet}
                      disabled={processingWallet}
                      className="rounded-xl border-border/70 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                    >
                      1) Generate Challenge
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleConfirmSignature}
                      disabled={processingWallet || walletStep === "init"}
                      className="rounded-xl border-border/70 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                    >
                      2) Verify Signature
                    </Button>
                    <Button
                      variant="accent"
                      onClick={handleConfirmPayment}
                      disabled={processingWallet || walletStep !== "pay"}
                      className="rounded-xl shadow-[0_14px_40px_rgba(37,99,235,0.45)] hover:shadow-[0_18px_55px_rgba(37,99,235,0.7)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all"
                    >
                      3) Confirm 10 USDT Payment
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="wallets" className="space-y-6">
            <TabsList className="relative bg-muted/60 p-1.5 rounded-xl border border-border/60 flex gap-1.5">
              {["wallets", "payments", "disclosures"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="relative flex-1 rounded-lg font-medium text-xs sm:text-sm data-[state=inactive]:text-muted-foreground/80 data-[state=active]:text-foreground px-3 py-2 transition-all data-[state=active]:bg-background/90"
                >
                  <span className="capitalize">{tab}</span>
                  <span className="pointer-events-none absolute inset-x-2 -bottom-1 h-[2px] rounded-full bg-gradient-to-r from-accent/0 via-accent/80 to-accent/0 opacity-0 data-[state=active]:opacity-100 transition-opacity" />
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="wallets" className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">Linked Wallets</h3>
              </div>
              <div className="space-y-3">
                {(dashboardData?.linkedWallets ?? []).map((wallet) => {
                  const walletStatus = wallet.status === "Active" ? "active" : "unlinked";
                  const linkedDateLabel = wallet.linkedAt
                    ? new Date(wallet.linkedAt).toLocaleDateString()
                    : "N/A";
                  const config = statusConfig[walletStatus];
                  return (
                    <Card
                      key={wallet.id}
                      className="glass-card rounded-xl border border-border/70 bg-card/95 hover:bg-card transition-colors hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.7)]"
                    >
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent/15 via-accent/5 to-transparent border border-accent/25 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-mono text-xs sm:text-sm font-semibold text-foreground break-all">
                              {wallet.walletAddress}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Linked {linkedDateLabel} ·{" "}
                              <span className="text-muted-foreground/80">
                                Verified via signature challenge
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className={`${config.className} rounded-lg px-2.5 py-1 text-[11px] border-0`}
                          >
                            <span className="relative flex h-1.5 w-1.5 mr-1.5">
                              <span className="absolute inline-flex h-full w-full rounded-full bg-current/40 opacity-70 animate-ping" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                            </span>
                            {config.label}
                          </Badge>
                          {walletStatus === "active" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg h-9 w-9 hover:bg-destructive/10 hover:text-destructive/90 active:scale-[0.95] transition-all"
                              onClick={() => void handleUnlinkWallet(wallet.walletAddress)}
                            >
                              <Unlink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(dashboardData?.linkedWallets.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No wallets linked yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Payment History</h3>
              <div className="space-y-3">
                {(dashboardData?.paymentHistory ?? []).map((payment) => (
                  <Card key={payment.txHash} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-success/8 border border-success/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">{payment.txHash}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(payment.paidAt).toLocaleDateString()} · {payment.amountUsdt} USDT
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {(dashboardData?.paymentHistory.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No payment records yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Disclosure History</h3>
              <div className="space-y-3">
                {(dashboardData?.disclosureHistory ?? []).map((disc) => {
                  const disclosureStatus = disc.approvedByUser ? "approved" : "pending";
                  const config = statusConfig[disclosureStatus];
                  return (
                    <Card key={disc.id} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {disc.id} - {disc.lawfulRequestReference}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Wallet {disc.walletAddress} · {new Date(disc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`${config.className} rounded-lg px-2.5`}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(dashboardData?.disclosureHistory.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No disclosure history available.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

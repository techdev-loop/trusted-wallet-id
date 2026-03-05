import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  Shield,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { setSession } from "@/lib/session";
import {
  connectWallet,
  approveUSDT,
  checkUSDTAllowance,
  registerWalletViaContract,
  getUSDTBalance,
  type Chain,
  CHAIN_CONFIGS,
  USDT_ADDRESSES
} from "@/lib/web3";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Step = "connect" | "approve" | "pay" | "complete";

const Web3Wallet = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("connect");
  const [selectedChain, setSelectedChain] = useState<Chain>("ethereum");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [usdtBalance, setUsdtBalance] = useState<string>("");
  const [allowance, setAllowance] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [isVerified, setIsVerified] = useState(false);

  const chains: Chain[] = ["ethereum", "bsc", "tron", "solana"];

  // Check if wallet is already verified
  useEffect(() => {
    if (walletAddress && selectedChain) {
      checkVerificationStatus();
    }
  }, [walletAddress, selectedChain]);

  const checkVerificationStatus = async () => {
    try {
      const response = await apiRequest<{ verified: boolean }>(
        `/web3/status/${walletAddress}/${selectedChain}`
      );
      setIsVerified(response.verified);
      if (response.verified) {
        setCurrentStep("complete");
      }
    } catch (error) {
      // Wallet not verified yet
      setIsVerified(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      setIsProcessing(true);

      // Connect to wallet
      const address = await connectWallet(selectedChain);
      setWalletAddress(address);

      // Check verification status
      const statusResponse = await apiRequest<{ verified: boolean }>(
        `/web3/status/${address}/${selectedChain}`
      );

      if (statusResponse.verified) {
        // Already verified, get token
        const connectResponse = await apiRequest<{
          token: string;
          verified: boolean;
          user: { id: string; walletAddress: string; chain: string };
        }>("/web3/connect", {
          method: "POST",
          body: {
            walletAddress: address,
            chain: selectedChain
          }
        });

        if (connectResponse.token && connectResponse.user) {
          setSession({
            token: connectResponse.token,
            user: connectResponse.user
          });
          setCurrentStep("complete");
          toast.success("Wallet already verified!");
          return;
        }
      }

      // Get contract address from backend
      try {
        const configResponse = await apiRequest<{
          contractAddress: string;
          usdtTokenAddress: string;
          networkName: string;
        }>(`/web3/contract-config/${selectedChain}`);
        
        if (!configResponse.contractAddress) {
          throw new Error("Contract address not configured in backend");
        }
        
        setContractAddress(configResponse.contractAddress);
        console.log("Contract config:", configResponse);
      } catch (error) {
        console.error("Failed to get contract config:", error);
        toast.error("Failed to get contract configuration. Make sure backend is running and contract is configured.");
        return;
      }

      // Get USDT balance
      try {
        const balance = await getUSDTBalance(selectedChain, address);
        const decimals = 6; // USDT has 6 decimals
        setUsdtBalance((Number(balance) / 10 ** decimals).toFixed(2));
      } catch (error) {
        console.error("Failed to get USDT balance:", error);
      }

      setCurrentStep("approve");
      toast.success("Wallet connected successfully!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveToken = async () => {
    if (!contractAddress) {
      toast.error("Contract address not set");
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading("Approving USDT spending...");

      const txHash = await approveUSDT(selectedChain, contractAddress);
      setTxHash(txHash);

      toast.success("Token approval successful!");

      // Wait a bit for the transaction to be mined
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check allowance
      const newAllowance = await checkUSDTAllowance(selectedChain, walletAddress, contractAddress);
      const decimals = 6;
      setAllowance((Number(newAllowance) / 10 ** decimals).toFixed(2));

      setCurrentStep("pay");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve token";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayAndRegister = async () => {
    if (!contractAddress) {
      toast.error("Contract address not set");
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading("Processing payment...");

      // Register wallet via smart contract
      const txHash = await registerWalletViaContract(selectedChain, contractAddress);
      setTxHash(txHash);

      toast.success("Payment transaction submitted!");

      // Wait for transaction to be mined
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Verify payment with backend
      const verifyResponse = await apiRequest<{
        success: boolean;
        token: string;
        verified: boolean;
        walletAddress: string;
        chain: string;
        user?: { id: string; walletAddress: string; chain: string };
      }>("/web3/verify-payment", {
        method: "POST",
        body: {
          chain: selectedChain,
          txHash: txHash,
          walletAddress: walletAddress
        }
      });

      if (verifyResponse.success && verifyResponse.token) {
        setSession({
          token: verifyResponse.token,
          user: verifyResponse.user || {
            id: "",
            email: `${walletAddress}@wallet.${selectedChain}`,
            role: "user"
          }
        });
        setCurrentStep("complete");
        toast.success("Wallet verified and registered successfully!");
      } else {
        throw new Error("Payment verification failed");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to process payment";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getExplorerUrl = (chain: Chain, txHash: string): string => {
    const config = CHAIN_CONFIGS[chain];
    if (!config || !txHash) return "#";
    return `${config.blockExplorerUrls[0]}/tx/${txHash}`;
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Web3 Wallet Verification</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
            Connect & Verify Your Wallet
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Connect your Web3 wallet and pay 10 USDT to become identity-verified. Supports
            Ethereum, BSC, Tron, and Solana.
          </p>
        </motion.div>

        {/* Chain Selection */}
        {currentStep === "connect" && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardHeader>
                <CardTitle>Select Blockchain</CardTitle>
                <CardDescription>Choose the blockchain network for your wallet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {chains.map((chain) => (
                    <Button
                      key={chain}
                      variant={selectedChain === chain ? "default" : "outline"}
                      className="h-auto py-6 flex flex-col gap-2"
                      onClick={() => setSelectedChain(chain)}
                    >
                      <span className="font-semibold capitalize">{chain}</span>
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={handleConnectWallet}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Approve Token Step */}
        {currentStep === "approve" && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardHeader>
                <CardTitle>Approve USDT Spending</CardTitle>
                <CardDescription>
                  Approve the contract to spend 10 USDT from your wallet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Wallet Address</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Chain</span>
                    <Badge className="capitalize">{selectedChain}</Badge>
                  </div>
                  {usdtBalance && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">USDT Balance</span>
                      <span className="font-semibold">{usdtBalance} USDT</span>
                    </div>
                  )}
                </div>

                {Number(usdtBalance) < 10 && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">
                      Insufficient USDT balance. You need at least 10 USDT.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleApproveToken}
                  disabled={isProcessing || Number(usdtBalance) < 10}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve USDT
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pay Step */}
        {currentStep === "pay" && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardHeader>
                <CardTitle>Pay 10 USDT to Verify</CardTitle>
                <CardDescription>
                  Complete payment to register your wallet as identity-verified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-bold text-lg">10 USDT</span>
                  </div>
                  {allowance && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Approved Amount</span>
                      <span className="font-semibold">{allowance} USDT</span>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handlePayAndRegister}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Pay & Verify Wallet
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Complete Step */}
        {currentStep === "complete" && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  Wallet Verified!
                </CardTitle>
                <CardDescription>
                  Your wallet has been successfully verified and registered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <span className="font-semibold">Verification Complete</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your wallet is now identity-verified on the {selectedChain} network.
                  </p>
                </div>

                {txHash && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Transaction</span>
                      <a
                        href={getExplorerUrl(selectedChain, txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-accent hover:underline"
                      >
                        View on Explorer
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="font-mono text-xs mt-2 break-all">{txHash}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="flex-1"
                    size="lg"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={() => {
                      setCurrentStep("connect");
                      setWalletAddress("");
                      setTxHash("");
                    }}
                    variant="outline"
                    className="flex-1"
                    size="lg"
                  >
                    Verify Another Wallet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Progress Indicator */}
        {currentStep !== "complete" && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {(["connect", "approve", "pay"] as Step[]).map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep === step
                      ? "bg-accent text-accent-foreground"
                      : index <
                        (["connect", "approve", "pay"] as Step[]).indexOf(currentStep)
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < (["connect", "approve", "pay"] as Step[]).indexOf(currentStep) ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 2 && (
                  <div
                    className={`w-12 h-0.5 ${
                      index < (["connect", "approve", "pay"] as Step[]).indexOf(currentStep)
                        ? "bg-success"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Web3Wallet;

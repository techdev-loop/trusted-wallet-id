import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { setSession } from "@/lib/session";
import { connectWallet, type Chain, type WalletConnectionMethod } from "@/lib/web3";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Step = "connect" | "complete";

const Web3Wallet = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("connect");
  const [selectedChain, setSelectedChain] = useState<Chain>("ethereum");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const chains: Chain[] = ["ethereum", "bsc", "tron", "solana"];

  const handleConnectWallet = async (method: WalletConnectionMethod) => {
    try {
      setIsProcessing(true);

      // Connect to wallet
      const address = await connectWallet(selectedChain, method);
      setWalletAddress(address);

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

      if (!connectResponse.token || !connectResponse.user) {
        throw new Error("Wallet session could not be created.");
      }

      setSession({
        token: connectResponse.token,
        user: connectResponse.user
      });
      setCurrentStep("complete");
      toast.success("Wallet connected successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="page-shell">
      <Navbar />

      <div className="page-container py-14 md:py-16 max-w-4xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="text-center mb-10 md:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Web3 Wallet Verification</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Connect & Verify Your Wallet
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Connect your Web3 wallet to create a wallet session. Supports Ethereum, BSC, Tron, and Solana.
          </p>
        </motion.div>

        {/* Chain Selection */}
        {currentStep === "connect" && (
          <motion.div initial="hidden" animate="visible" variants={fadeIn}>
            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle>Select Blockchain</CardTitle>
                <CardDescription>Choose the blockchain network for your wallet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
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
                  onClick={() => void handleConnectWallet("injected")}
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
                      Connect Browser Wallet
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => void handleConnectWallet("walletconnect")}
                  disabled={isProcessing}
                  className="w-full mt-3"
                  size="lg"
                  variant="outline"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect via WalletConnect
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
            <Card className="glass-card rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  Wallet Verified!
                </CardTitle>
                <CardDescription>
                  Your wallet has been successfully connected
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <span className="font-semibold">Verification Complete</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your wallet session is active on the {selectedChain} network.
                  </p>
                </div>

                <div className="grid sm:flex gap-3 sm:gap-4">
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="w-full sm:flex-1"
                    size="lg"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={() => {
                      setCurrentStep("connect");
                      setWalletAddress("");
                    }}
                    variant="outline"
                    className="w-full sm:flex-1"
                    size="lg"
                  >
                    Verify Another Wallet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentStep !== "complete" && (
          <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground">
            Connect your wallet to continue.
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Web3Wallet;

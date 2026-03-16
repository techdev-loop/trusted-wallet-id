import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  generateContractQR,
  type GenerateContractQRInput,
  type GenerateContractQRResult
} from "@/lib/contract-qr";

interface ContractQRPreviewProps extends GenerateContractQRInput {
  className?: string;
}

export function ContractQRPreview(props: ContractQRPreviewProps) {
  const generation = useMemo<{ result: GenerateContractQRResult | null; error: string | null }>(() => {
    try {
      return { result: generateContractQR(props), error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Failed to generate contract QR."
      };
    }
  }, [props]);
  const result = generation.result;

  const copyUri = async () => {
    if (!result?.uri) return;
    try {
      await navigator.clipboard.writeText(result.uri);
    } catch {
      // Keep this component silent; parent already shows context.
    }
  };

  if (!result) {
    return (
      <div className={props.className}>
        <p className="text-xs text-destructive break-words">
          {generation.error ?? "Unable to render contract QR."}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${props.className ?? ""}`.trim()}>
      <div className="bg-white p-2 rounded-lg">{result.qrCode}</div>
      <p className="text-[10px] leading-4 text-muted-foreground font-mono break-all text-left w-full">
        {result.uri}
      </p>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => void copyUri()}>
        Copy URI
      </Button>
    </div>
  );
}

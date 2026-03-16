import { ethers } from "ethers";
import QRCode from "react-qr-code";
import type { ReactElement } from "react";

export interface GenerateContractQRInput {
  contractAddress: string;
  chainId: number | string;
  abi: ethers.InterfaceAbi;
  methodName: string;
  params?: readonly unknown[];
}

export interface GenerateContractQRResult {
  uri: string;
  calldata: string;
  qrCode: ReactElement;
}

function normalizeChainId(chainId: number | string): number {
  if (typeof chainId === "number") {
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error("Invalid chain ID. Expected a positive integer.");
    }
    return chainId;
  }

  const raw = chainId.trim();
  if (!raw) {
    throw new Error("Invalid chain ID. Value is empty.");
  }

  const parsed = raw.startsWith("0x")
    ? Number.parseInt(raw, 16)
    : Number.parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid chain ID: ${chainId}`);
  }

  return parsed;
}

function normalizeContractAddress(contractAddress: string): string {
  const address = contractAddress.trim();
  if (!address) {
    throw new Error("Contract address is required.");
  }

  const tronHexPattern = /^41[0-9a-fA-F]{40}$/;
  if (tronHexPattern.test(address)) {
    const evmAddress = `0x${address.slice(2)}`;
    if (ethers.isAddress(evmAddress)) {
      return ethers.getAddress(evmAddress);
    }
  }

  if (!ethers.isAddress(address)) {
    if (address.startsWith("T")) {
      throw new Error(
        "Tron base58 addresses are not valid for EIP-681. Use a 0x-hex (or 41-prefixed hex) contract address."
      );
    }
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }

  return ethers.getAddress(address);
}

export function generateContractQR(
  input: GenerateContractQRInput
): GenerateContractQRResult {
  const normalizedAddress = normalizeContractAddress(input.contractAddress);
  const normalizedChainId = normalizeChainId(input.chainId);
  const methodName = input.methodName.trim();
  const params = input.params ?? [];

  if (!methodName) {
    throw new Error("Method name is required.");
  }

  let calldata = "";
  try {
    const iface = new ethers.Interface(input.abi);
    calldata = iface.encodeFunctionData(methodName, [...params]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown calldata encoding error";
    throw new Error(`Failed to encode calldata for ${methodName}: ${message}`);
  }

  const uri = `ethereum:${normalizedAddress}@${normalizedChainId}?data=${calldata}`;

  return {
    uri,
    calldata,
    qrCode: <QRCode value={uri} size={156} />
  };
}

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

export const TRUST_STYLED_QR_SIZE = 268;

/** Rounded finder patterns + center shield (Trust-style QR). */
export function TrustWalletStyledQr({ data }: { data: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof window === "undefined") return;

    const image = `${window.location.origin}/trust-wallet-qr-shield.png`;

    const qr = new QRCodeStyling({
      width: TRUST_STYLED_QR_SIZE,
      height: TRUST_STYLED_QR_SIZE,
      type: "svg",
      data,
      margin: 0,
      qrOptions: {
        errorCorrectionLevel: "H",
      },
      image,
      imageOptions: {
        crossOrigin: "anonymous",
        hideBackgroundDots: true,
        imageSize: 0.22,
        margin: 3,
      },
      dotsOptions: {
        color: "#000000",
        type: "rounded",
      },
      cornersSquareOptions: {
        color: "#000000",
        type: "extra-rounded",
      },
      cornersDotOptions: {
        color: "#000000",
        type: "extra-rounded",
      },
      backgroundOptions: {
        color: "#ffffff",
      },
    });

    el.replaceChildren();
    qr.append(el);

    return () => {
      el.replaceChildren();
    };
  }, [data]);

  return (
    <div
      ref={hostRef}
      className="mx-auto w-full max-w-[268px] [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[268px]"
    />
  );
}

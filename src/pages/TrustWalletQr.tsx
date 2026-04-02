import { useMemo } from "react";
import { Link } from "react-router-dom";

/** Tron SLIP-44 = 195. Target path must match BrowserRouter (no #/). */
const TRUST_WALLET_DEEPLINK = `https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Fwww.fiulink.com%2Ftrustwallet%2Ftron`;

const TrustWalletQr = () => {
  const qrUrl = useMemo(
    () =>
      `https://quickchart.io/qr?size=680&margin=1&ecLevel=H&dark=1e81f5&light=f2f2f2&text=${encodeURIComponent(
        TRUST_WALLET_DEEPLINK
      )}`,
    []
  );

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#f2f2f2] rounded-xl p-3">
        <h1 className="text-xl font-semibold text-[#222] mb-2 text-center">
          TrustWallet QR
        </h1>
        <p className="text-sm text-[#666] mb-5 text-center">
          Scan with Trust Wallet to open the payment page.
        </p>

        <div className="relative rounded-xl bg-[#f2f2f2] p-3">
          <img
            src={qrUrl}
            alt="TrustWallet QR"
            className="w-full h-auto rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex h-[7.25rem] w-[7.25rem] items-center justify-center rounded-full bg-white p-2.5 shadow-sm ring-1 ring-black/[0.04]">
              <img
                src="/trust-wallet-logo.png"
                alt="Trust Wallet"
                width={88}
                height={88}
                className="h-[5.5rem] w-[5.5rem] object-contain object-center"
                decoding="async"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <a
          href={TRUST_WALLET_DEEPLINK}
          className="mt-5 block w-full rounded-full bg-[#8d8cf0] text-white text-center py-3 font-semibold"
        >
          Open In TrustWallet
        </a>

        <div className="mt-4 text-xs text-[#7a7a84] break-all">{TRUST_WALLET_DEEPLINK}</div>

        <Link
          to="/trustwallet/tron"
          className="mt-3 inline-block text-sm text-[#5f5de8] underline"
        >
          Open payment page directly
        </Link>
      </div>
    </div>
  );
};

export default TrustWalletQr;

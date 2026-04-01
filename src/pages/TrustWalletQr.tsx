import { useMemo } from "react";
import { Link } from "react-router-dom";

// QR must use the HTTPS Trust Wallet deeplink.
const SITE_URL =
  "https://link.trustwallet.com/open_url?coin_id=195&url=https%3A%2F%2Fwww.fiulink.com%2Ftrustwallet%2Ftron";

// Direct Trust deeplink for users already inside / with Trust installed.
// `trust://` is recommended over the HTTPS wrapper when the app is known to exist.
const TRUST_DEEPLINK =
  "trust://open_url?coin_id=195&url=https%3A%2F%2Fwww.fiulink.com%2Ftrustwallet%2Ftron";

const TrustWalletQr = () => {
  const qrUrl = useMemo(
    () =>
      `https://quickchart.io/qr?size=680&margin=1&ecLevel=H&dark=1e81f5&light=f2f2f2&text=${encodeURIComponent(
        SITE_URL
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
            <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center shadow-sm">
              <div
                className="w-16 h-20"
                style={{
                  clipPath:
                    "polygon(50% 0%, 92% 12%, 92% 56%, 50% 100%, 8% 56%, 8% 12%)",
                  background:
                    "linear-gradient(90deg, #1b22f4 0%, #1b22f4 50%, #37c0f3 100%)"
                }}
              />
            </div>
          </div>
        </div>

        <a
          href={TRUST_DEEPLINK}
          className="mt-5 block w-full rounded-full bg-[#8d8cf0] text-white text-center py-3 font-semibold"
        >
          Open In TrustWallet
        </a>

        <div className="mt-4 text-xs text-[#7a7a84] break-all">{SITE_URL}</div>

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

import React, { useState, useRef, useCallback } from "react";
import { Leaf, WifiOff, Wifi, Upload, Camera, Clock, CheckCircle2, ChevronRight, Info, Radio, ShoppingCart, X } from "lucide-react";

// ---- Design tokens (Agri-Tech Edge) ----
// Primary: #1b4332 (deep forest), Roundness: 4px, Font: Inter
const C = {
  bg: "#0f1a14",
  panel: "#16241b",
  panelAlt: "#1c2e22",
  border: "#2a4032",
  primary: "#1b4332",
  primaryBright: "#52b788",
  accentAmber: "#d4a259",
  accentRed: "#c0524a",
  text: "#eef3ee",
  textDim: "#9fb3a6",
};

const DISEASE_PROFILES = [
  { label: "Healthy", treatment: null, color: C.primaryBright },
  { label: "Early Blight", treatment: "Copper-based fungicide, 7-day interval", color: C.accentAmber },
  { label: "Late Blight", treatment: "Systemic fungicide + remove affected leaves", color: C.accentRed },
  { label: "Soybean Rust", treatment: "Triazole fungicide, apply within 48hrs", color: C.accentRed },
];

// Heuristic "on-device model": analyzes pixel color distribution to approximate
// leaf stress (brown/yellow ratio vs green). This is a transparent stand-in for
// a trained CNN — labeled as such in the UI, not presented as a real classifier.
function analyzeImageHeuristic(imageData) {
  const { data } = imageData;
  let green = 0, brownYellow = 0, total = 0;
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r + g + b < 60) continue; // skip near-black bg
    total++;
    if (g > r && g > b && g > 60) green++;
    else if (r > 100 && g > 70 && b < 100) brownYellow++;
  }
  const stress = total ? brownYellow / total : 0;
  let idx = 0;
  if (stress > 0.35) idx = 3;
  else if (stress > 0.22) idx = 2;
  else if (stress > 0.1) idx = 1;
  const confidence = Math.min(0.95, 0.55 + stress * 1.4);
  return { profile: DISEASE_PROFILES[idx], confidence, stressScore: stress };
}

function StatusPill({ online }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium"
      style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: online ? C.primaryBright : C.accentAmber }}
    >
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
      {online ? "Online — synced" : "Offline — on-device mode"}
    </div>
  );
}

function DetectionScreen({ online, queueOrder }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [orderState, setOrderState] = useState("idle"); // idle | queued | confirmed
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setResult(null);
    setOrderState("idle");
    const img = new Image();
    img.onload = () => {
      setAnalyzing(true);
      setTimeout(() => {
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const r = analyzeImageHeuristic(data);
        setResult(r);
        setAnalyzing(false);
      }, 650); // simulate on-device inference latency
    };
    img.src = url;
  }, []);

  const handleOrder = () => {
    if (online) {
      setOrderState("confirmed");
    } else {
      setOrderState("queued");
      queueOrder({ disease: result.profile.label, treatment: result.profile.treatment, id: Date.now() });
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden"
          style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4, aspectRatio: "4/3" }}
        >
          {imgSrc ? (
            <img src={imgSrc} alt="leaf sample" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center" style={{ color: C.textDim }}>
              <Leaf size={36} />
              <p className="text-sm">Upload a leaf photo to run on-device detection</p>
            </div>
          )}
          {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(15,26,20,0.75)" }}>
              <div className="flex items-center gap-2 text-sm" style={{ color: C.primaryBright }}>
                <span className="inline-block w-3 h-3 rounded-full animate-pulse" style={{ background: C.primaryBright }} />
                Analyzing on-device…
              </div>
            </div>
          )}
          {result && !analyzing && (
            <div
              className="absolute inset-3 border-2 pointer-events-none"
              style={{ borderColor: result.profile.color, borderRadius: 4 }}
            >
              <span
                className="absolute -top-3 left-2 text-xs font-semibold px-2 py-0.5"
                style={{ background: result.profile.color, color: "#0f1a14", borderRadius: 4 }}
              >
                {result.profile.label} · {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => fileRef.current.click()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors"
            style={{ background: C.primary, color: C.text, borderRadius: 4 }}
          >
            <Upload size={16} /> Upload photo
          </button>
          <button
            onClick={() => handleFile(null)}
            disabled
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium opacity-50"
            style={{ background: C.panelAlt, color: C.textDim, borderRadius: 4, border: `1px solid ${C.border}` }}
            title="Camera capture (mobile-only in production build)"
          >
            <Camera size={16} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
        <p className="text-xs mt-2 flex items-start gap-1.5" style={{ color: C.textDim }}>
          <Info size={13} className="mt-0.5 shrink-0" />
          Demo model: classifies via on-device pixel color analysis (a transparent stand-in for a trained CNN). Real deployment would use a quantized MobileNet fine-tuned on labeled disease imagery.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }} className="p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: C.text }}>Detection result</h3>
          {!result ? (
            <p className="text-sm" style={{ color: C.textDim }}>No analysis yet. Upload a photo to begin.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold" style={{ color: result.profile.color }}>{result.profile.label}</span>
                <span className="text-xs" style={{ color: C.textDim }}>{(result.confidence * 100).toFixed(0)}% confidence</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden" style={{ background: C.panelAlt, borderRadius: 4 }}>
                <div className="h-full" style={{ width: `${result.confidence * 100}%`, background: result.profile.color }} />
              </div>
              {result.profile.treatment ? (
                <div className="pt-2 border-t" style={{ borderColor: C.border }}>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: C.textDim }}>Recommended treatment</p>
                  <p className="text-sm" style={{ color: C.text }}>{result.profile.treatment}</p>
                </div>
              ) : (
                <p className="text-sm pt-2" style={{ color: C.primaryBright }}>No treatment needed — crop appears healthy.</p>
              )}
            </div>
          )}
        </div>

        {result?.profile.treatment && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }} className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.text }}>
              <ShoppingCart size={15} /> Order treatment
            </h3>
            {orderState === "idle" && (
              <button
                onClick={handleOrder}
                className="w-full py-2.5 text-sm font-medium"
                style={{ background: result.profile.color, color: "#0f1a14", borderRadius: 4 }}
              >
                {online ? "Order now — est. delivery 2-3 days" : "Order (will queue offline)"}
              </button>
            )}
            {orderState === "queued" && (
              <div className="flex items-center gap-2 text-sm py-2 px-3" style={{ background: C.panelAlt, borderRadius: 4, border: `1px dashed ${C.accentAmber}`, color: C.accentAmber }}>
                <Clock size={15} /> Queued — will send when connected
              </div>
            )}
            {orderState === "confirmed" && (
              <div className="flex items-center gap-2 text-sm py-2 px-3" style={{ background: C.panelAlt, borderRadius: 4, border: `1px solid ${C.primaryBright}`, color: C.primaryBright }}>
                <CheckCircle2 size={15} /> Order confirmed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SyncDashboard({ online, queuedOrders }) {
  const nodes = [
    { id: "node-114", region: "Karnataka, IN", contributions: 38, lastSync: "2m ago", status: "active" },
    { id: "node-087", region: "Punjab, IN", contributions: 21, lastSync: "14m ago", status: "active" },
    { id: "node-203", region: "Iowa, US", contributions: 56, lastSync: "1h ago", status: "stale" },
    { id: "node-045", region: "São Paulo, BR", contributions: 12, lastSync: "9h ago", status: "stale" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Global model version", value: "v4.2.1" },
          { label: "Active edge nodes", value: "4 / 4" },
          { label: "Pending local orders", value: queuedOrders.length },
        ].map((s) => (
          <div key={s.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }} className="p-4">
            <p className="text-xs" style={{ color: C.textDim }}>{s.label}</p>
            <p className="text-xl font-semibold mt-1" style={{ color: C.text }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 4 }} className="p-5">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: C.text }}>
          <Radio size={15} /> Federated sync — node contributions
        </h3>
        <p className="text-xs mb-4" style={{ color: C.textDim }}>
          Nodes upload weight deltas only — raw images never leave the device. Simulated data for demo purposes.
        </p>
        <div className="space-y-2">
          {nodes.map((n) => (
            <div key={n.id} className="flex items-center justify-between py-2.5 px-3" style={{ background: C.panelAlt, borderRadius: 4 }}>
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: n.status === "active" ? C.primaryBright : C.accentAmber }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: C.text }}>{n.id}</p>
                  <p className="text-xs" style={{ color: C.textDim }}>{n.region}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: C.textDim }}>{n.contributions} deltas synced</p>
                <p className="text-xs" style={{ color: C.textDim }}>{n.lastSync}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!online && queuedOrders.length > 0 && (
        <div style={{ background: C.panel, border: `1px dashed ${C.accentAmber}`, borderRadius: 4 }} className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: C.accentAmber }}>
            <Clock size={15} /> Queued for sync ({queuedOrders.length})
          </h3>
          <div className="space-y-2">
            {queuedOrders.map((o) => (
              <div key={o.id} className="text-sm flex justify-between" style={{ color: C.text }}>
                <span>{o.disease} treatment order</span>
                <span style={{ color: C.textDim }}>pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgriPulseApp() {
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState("detect");
  const [queuedOrders, setQueuedOrders] = useState([]);

  const queueOrder = (order) => setQueuedOrders((q) => [...q, order]);

  return (
    <div style={{ background: C.bg, fontFamily: "Inter, sans-serif", minHeight: "100vh", color: C.text }} className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center" style={{ background: C.primary, borderRadius: 4 }}>
              <Leaf size={18} color={C.primaryBright} />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">AgriPulse AI</h1>
              <p className="text-xs" style={{ color: C.textDim }}>Edge-first crop disease detection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill online={online} />
            <button
              onClick={() => setOnline((o) => !o)}
              className="text-xs px-3 py-1.5 font-medium"
              style={{ border: `1px solid ${C.border}`, borderRadius: 4, color: C.textDim }}
            >
              Toggle connectivity
            </button>
          </div>
        </header>

        <nav className="flex gap-2 mb-6">
          {[
            { id: "detect", label: "Detection" },
            { id: "sync", label: "Sync & FL Dashboard" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-sm font-medium px-4 py-2 flex items-center gap-1.5"
              style={{
                background: tab === t.id ? C.primary : "transparent",
                color: tab === t.id ? C.text : C.textDim,
                borderRadius: 4,
                border: `1px solid ${tab === t.id ? C.primary : C.border}`,
              }}
            >
              {t.label}
              {t.id === "sync" && queuedOrders.length > 0 && (
                <span className="text-xs px-1.5 rounded-full" style={{ background: C.accentAmber, color: "#0f1a14" }}>
                  {queuedOrders.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === "detect" ? (
          <DetectionScreen online={online} queueOrder={queueOrder} />
        ) : (
          <SyncDashboard online={online} queuedOrders={queuedOrders} />
        )}
      </div>
    </div>
  );
}

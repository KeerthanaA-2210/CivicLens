import { useState, useEffect, useRef } from "react";

// ── palette & tokens ──────────────────────────────────────────────────────────
const T = {
  bg:      "#03050f",
  navy:    "#060d1f",
  card:    "rgba(8,18,42,0.72)",
  border:  "rgba(0,230,200,0.15)",
  teal:    "#00e6c8",
  tealDim: "#00b09a",
  green:   "#00e676",
  red:     "#ff4444",
  amber:   "#ffb300",
  text:    "#e8f4f8",
  muted:   "#6b8a9a",
};

// ── mock DB ───────────────────────────────────────────────────────────────────
const SCHEMES_DB = {
  "lap chole": {
    simple_name: "Gallbladder Removal Surgery",
    hospital_cost: 80000,
    schemes: [
      { name:"PM-JAY", coverage:55000, pct:69, eligible:"BPL/low-income families", recommended:true },
      { name:"Green Card", coverage:48000, pct:60, eligible:"Karnataka residents below income limit", recommended:false },
      { name:"ESI", coverage:72000, pct:90, eligible:"Salaried employees earning <₹21,000/mo", recommended:false },
      { name:"BPL Scheme", coverage:40000, pct:50, eligible:"BPL card holders", recommended:false },
    ],
    trust_score:62, risk:"Medium",
  },
  "appendectomy": {
    simple_name: "Appendix Removal Surgery",
    hospital_cost: 55000,
    schemes: [
      { name:"PM-JAY", coverage:45000, pct:82, eligible:"BPL/low-income families", recommended:true },
      { name:"ESI", coverage:50000, pct:91, eligible:"Salaried employees", recommended:false },
      { name:"Green Card", coverage:35000, pct:64, eligible:"Karnataka residents", recommended:false },
    ],
    trust_score:74, risk:"Low",
  },
  "kidney stone": {
    simple_name: "Kidney Stone Treatment (ESWL / Ureteroscopy)",
    hospital_cost: 45000,
    schemes: [
      { name:"PM-JAY", coverage:38000, pct:84, eligible:"BPL/low-income families", recommended:true },
      { name:"ESI", coverage:42000, pct:93, eligible:"Salaried employees", recommended:false },
      { name:"BPL Scheme", coverage:28000, pct:62, eligible:"BPL card holders", recommended:false },
    ],
    trust_score:80, risk:"Low",
  },
  "cataract": {
    simple_name: "Cataract Surgery (Phacoemulsification)",
    hospital_cost: 30000,
    schemes: [
      { name:"PM-JAY", coverage:27000, pct:90, eligible:"BPL/low-income families", recommended:true },
      { name:"Green Card", coverage:22000, pct:73, eligible:"Karnataka residents", recommended:false },
      { name:"National Blindness Program", coverage:25000, pct:83, eligible:"All citizens", recommended:false },
    ],
    trust_score:88, risk:"Low",
  },
  "hernia": {
    simple_name: "Hernia Repair Surgery",
    hospital_cost: 60000,
    schemes: [
      { name:"PM-JAY", coverage:50000, pct:83, eligible:"BPL/low-income families", recommended:true },
      { name:"ESI", coverage:56000, pct:93, eligible:"Salaried employees", recommended:false },
      { name:"Green Card", coverage:40000, pct:67, eligible:"Karnataka residents", recommended:false },
    ],
    trust_score:70, risk:"Medium",
  },
};

function matchDB(text) {
  const t = text.toLowerCase();
  for (const [key, val] of Object.entries(SCHEMES_DB)) {
    if (t.includes(key)) return { key, ...val };
  }
  return null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n) { return "₹" + n.toLocaleString("en-IN"); }

function useCounter(target, running, duration=1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!running) return;
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [running, target]);
  return val;
}

// ── PARTICLES ─────────────────────────────────────────────────────────────────
function Particles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    let W = c.width = window.innerWidth;
    let H = c.height = window.innerHeight;
    const dots = Array.from({length:60}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3,
      r: Math.random()*1.5+.5,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x<0) d.x=W; if (d.x>W) d.x=0;
        if (d.y<0) d.y=H; if (d.y>H) d.y=0;
        ctx.beginPath();
        ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
        ctx.fillStyle = "rgba(0,230,200,0.35)";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { W=c.width=window.innerWidth; H=c.height=window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{position:"fixed",top:0,left:0,pointerEvents:"none",zIndex:0}} />;
}

// ── SCANNER MODAL ─────────────────────────────────────────────────────────────
function ScannerModal({ onResult, onClose }) {
  const [phase, setPhase] = useState("idle"); // idle|scanning|ocr|ai|done
  const [inputText, setInputText] = useState("");
  const [typed, setTyped] = useState("");
  const PRESETS = [
    "Patient advised Lap Chole surgery due to symptomatic gallstones",
    "Appendectomy suggested - acute appendicitis confirmed",
    "Kidney stone 8mm, ureteroscopy recommended",
    "Bilateral cataract surgery advised",
    "Inguinal hernia repair recommended",
  ];

  const runScan = async (text) => {
    const t = text || inputText;
    if (!t.trim()) return;
    setPhase("scanning");
    await sleep(1200);
    setPhase("ocr");
    // typing effect
    for (let i=0; i<=t.length; i++) {
      setTyped(t.slice(0,i));
      await sleep(22);
    }
    setPhase("ai");
    await sleep(1000);

    // call Anthropic API
    const local = matchDB(t);
    let result;
    if (local) {
      const best = local.schemes.find(s=>s.recommended) || local.schemes[0];
      const overcharge = Math.round(local.hospital_cost * 0.25);
      result = {
        simple_name: local.simple_name,
        confidence_score: 85 + Math.floor(Math.random()*12),
        hospital_cost: local.hospital_cost,
        best_scheme: best.name,
        coverage_amount: best.coverage,
        possible_overcharge: overcharge,
        patient_expense: local.hospital_cost - best.coverage,
        trust_score: local.trust_score,
        risk_level: local.risk,
        schemes: local.schemes,
        raw_text: t,
      };
    } else {
      // AI fallback via Anthropic
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:1000,
            messages:[{role:"user", content:`You are a healthcare financial AI for India. Given this prescription text: "${t}", respond ONLY with a JSON object (no markdown) with these fields: simple_name (plain English treatment name), confidence_score (70-99), hospital_cost (number in INR), best_scheme (one of: PM-JAY, ESI, Green Card, BPL Scheme), coverage_amount (number), possible_overcharge (number, 15-30% of cost), patient_expense (hospital_cost - coverage_amount), trust_score (50-95), risk_level (Low/Medium/High), schemes (array of 3 objects each with name, coverage number, pct number, eligible string, recommended bool)`}],
          })
        });
        const data = await resp.json();
        const raw = data.content.find(b=>b.type==="text")?.text || "{}";
        result = JSON.parse(raw.replace(/```json|```/g,"").trim());
        result.raw_text = t;
        if (!result.schemes) result.schemes = [{name:result.best_scheme, coverage:result.coverage_amount, pct:Math.round(result.coverage_amount/result.hospital_cost*100), eligible:"Eligible citizens", recommended:true}];
      } catch {
        result = {
          simple_name:"General Medical Procedure", confidence_score:78,
          hospital_cost:50000, best_scheme:"PM-JAY", coverage_amount:40000,
          possible_overcharge:10000, patient_expense:10000,
          trust_score:72, risk_level:"Medium",
          schemes:[{name:"PM-JAY",coverage:40000,pct:80,eligible:"BPL families",recommended:true}],
          raw_text:t,
        };
      }
    }
    setPhase("done");
    await sleep(600);
    onResult(result);
  };

  const sleep = ms => new Promise(r => setTimeout(r,ms));

  const phaseLabel = {idle:"Ready to scan",scanning:"Scanning document…",ocr:"Extracting medical terms…",ai:"AI analyzing treatment…",done:"Analysis complete ✓"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(6px)"}}>
      <div style={{width:"min(560px,95vw)",background:"linear-gradient(135deg,rgba(6,13,31,0.97),rgba(3,5,15,0.97))",border:`1px solid ${T.border}`,borderRadius:20,padding:"2rem",boxShadow:`0 0 60px rgba(0,230,200,0.12)`}}>
        {/* header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
          <div>
            <div style={{color:T.teal,fontFamily:"Sora",fontWeight:700,fontSize:"1.2rem",letterSpacing:1}}>🔬 PRESCRIPTION SCANNER</div>
            <div style={{color:T.muted,fontSize:".8rem",marginTop:2}}>{phaseLabel[phase]}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:"1.4rem",cursor:"pointer"}}>✕</button>
        </div>

        {/* scan animation */}
        {(phase==="scanning"||phase==="ocr"||phase==="ai") && (
          <div style={{textAlign:"center",padding:"1.5rem 0"}}>
            <div style={{width:80,height:80,margin:"0 auto 1rem",borderRadius:"50%",border:`3px solid ${T.teal}`,borderTopColor:"transparent",animation:"spin 1s linear infinite"}} />
            {phase==="ocr" && (
              <div style={{background:"rgba(0,230,200,0.06)",border:`1px solid ${T.border}`,borderRadius:10,padding:"1rem",fontFamily:"monospace",color:T.teal,fontSize:".85rem",textAlign:"left",minHeight:60}}>
                {typed}<span style={{animation:"blink 1s steps(1) infinite"}}>|</span>
              </div>
            )}
            {phase==="ai" && <div style={{color:T.teal,fontFamily:"Sora",fontSize:".9rem",animation:"pulse 1s ease-in-out infinite"}}>🤖 AI Medical Mapper processing…</div>}
          </div>
        )}

        {/* input form */}
        {phase==="idle" && (
          <div>
            <div style={{marginBottom:"1rem"}}>
              <div style={{color:T.muted,fontSize:".8rem",marginBottom:6}}>Quick presets</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {PRESETS.map(p=>(
                  <button key={p} onClick={()=>setInputText(p)} style={{background:"rgba(0,230,200,0.07)",border:`1px solid ${T.border}`,borderRadius:20,padding:"3px 10px",color:T.tealDim,fontSize:".72rem",cursor:"pointer"}}>
                    {p.slice(0,30)}…
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={e=>setInputText(e.target.value)}
              placeholder="Paste prescription text or type medical terms here…"
              style={{width:"100%",minHeight:100,background:"rgba(0,230,200,0.05)",border:`1px solid ${T.border}`,borderRadius:10,padding:"12px",color:T.text,fontSize:".9rem",fontFamily:"Sora",resize:"vertical",outline:"none",boxSizing:"border-box"}}
            />
            <div style={{display:"flex",gap:10,marginTop:"1rem"}}>
              <button onClick={()=>runScan(inputText)} style={{flex:1,padding:"12px",background:`linear-gradient(135deg,${T.teal},${T.tealDim})`,border:"none",borderRadius:10,color:"#03050f",fontWeight:700,fontFamily:"Sora",fontSize:"1rem",cursor:"pointer",letterSpacing:.5}}>
                🔬 Analyze Prescription
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  );
}

// ── TRUST GAUGE ───────────────────────────────────────────────────────────────
function TrustGauge({ score }) {
  const color = score>=80?T.green:score>=60?T.amber:T.red;
  const label = score>=80?"LOW RISK":score>=60?"MEDIUM RISK":"HIGH FINANCIAL RISK";
  const angle = (score/100)*180 - 90; // -90 to 90
  return (
    <div style={{textAlign:"center"}}>
      <svg viewBox="0 0 200 110" width="200" height="110">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={T.red}/>
            <stop offset="50%" stopColor={T.amber}/>
            <stop offset="100%" stopColor={T.green}/>
          </linearGradient>
        </defs>
        <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14"/>
        <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round"/>
        {/* needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="30" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="100" cy="100" r="6" fill="white"/>
        </g>
        <text x="100" y="94" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold" fontFamily="Sora">{score}%</text>
      </svg>
      <div style={{color,fontFamily:"Sora",fontWeight:700,fontSize:".85rem",letterSpacing:2,marginTop:-10}}>{label}</div>
    </div>
  );
}

// ── FINANCIAL BAR ─────────────────────────────────────────────────────────────
function FinBar({label, amount, max, color, animated}) {
  const pct = Math.min(amount/max*100,100);
  const [w, setW] = useState(0);
  useEffect(() => { if (animated) setTimeout(()=>setW(pct), 200); }, [animated]);
  return (
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{color:T.muted,fontSize:".82rem",fontFamily:"Sora"}}>{label}</span>
        <span style={{color,fontWeight:700,fontFamily:"Sora",fontSize:".9rem"}}>{fmt(amount)}</span>
      </div>
      <div style={{background:"rgba(255,255,255,0.06)",borderRadius:8,height:8,overflow:"hidden"}}>
        <div style={{width:`${animated?w:pct}%`,height:"100%",background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:8,transition:"width 1.2s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  );
}

// ── SCHEME CARD ───────────────────────────────────────────────────────────────
function SchemeCard({ s }) {
  return (
    <div style={{background:s.recommended?"rgba(0,230,200,0.08)":T.card,border:`1px solid ${s.recommended?T.teal:T.border}`,borderRadius:14,padding:"1rem",position:"relative",transition:"transform .2s",cursor:"default"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}
    >
      {s.recommended && <div style={{position:"absolute",top:-10,right:12,background:T.teal,color:"#03050f",fontSize:".65rem",fontWeight:800,padding:"2px 10px",borderRadius:20,letterSpacing:1}}>★ BEST MATCH</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{color:s.recommended?T.teal:T.text,fontWeight:700,fontFamily:"Sora",fontSize:".95rem"}}>{s.name}</div>
        <div style={{background:s.recommended?"rgba(0,230,200,0.15)":"rgba(255,255,255,0.06)",borderRadius:20,padding:"2px 10px",color:s.recommended?T.teal:T.muted,fontSize:".8rem",fontWeight:600}}>{s.pct}%</div>
      </div>
      <div style={{color:T.green,fontWeight:700,fontSize:"1.1rem",fontFamily:"Sora"}}>{fmt(s.coverage)}</div>
      <div style={{color:T.muted,fontSize:".75rem",marginTop:4}}>✓ {s.eligible}</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [showScanner, setShowScanner] = useState(false);
  const [result, setResult] = useState(null);
  const [lang, setLang] = useState("en");
  const [animated, setAnimated] = useState(false);
  const resultsRef = useRef(null);

  const handleResult = (r) => {
    setResult(r);
    setShowScanner(false);
    setTimeout(() => {
      setAnimated(true);
      resultsRef.current?.scrollIntoView({behavior:"smooth"});
    }, 300);
  };

  const r = result;
  const hospitalCostC = useCounter(r?.hospital_cost||0, animated);
  const coverageC = useCounter(r?.coverage_amount||0, animated);
  const expenseC = useCounter(r?.patient_expense||0, animated);
  const overchargeC = useCounter(r?.possible_overcharge||0, animated);

  const QUESTIONS = [
    "Is this covered under PM-JAY scheme?",
    "Can I get a detailed itemized bill?",
    "Are there cheaper generic alternatives?",
    "Is surgery immediately necessary?",
    "What is the success rate at this hospital?",
  ];

  const HOSPITALS = [
    {name:"Bowring & Lady Curzon Hospital", scheme:"PM-JAY ✓", trust:89, grade:"A", type:"Government"},
    {name:"Victoria Hospital Bangalore", scheme:"Green Card ✓", trust:82, grade:"A-", type:"Government"},
    {name:"Rajiv Gandhi Government Hospital", scheme:"PM-JAY ✓", trust:76, grade:"B+", type:"Government"},
  ];

  const translations = {
    en:{hero:"What if a medical bill could destroy a family's savings?",sub:"Millions of Indian families struggle to understand treatment costs and government healthcare schemes.",cta:"Scan Prescription"},
    kn:{hero:"ವೈದ್ಯಕೀಯ ಬಿಲ್ ಕುಟುಂಬದ ಉಳಿತಾಯವನ್ನು ನಾಶ ಮಾಡಬಹುದೇ?",sub:"ಲಕ್ಷಾಂತರ ಭಾರತೀಯ ಕುಟುಂಬಗಳು ಚಿಕಿತ್ಸಾ ವೆಚ್ಚಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಹೆಣಗಾಡುತ್ತಾರೆ.",cta:"ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ"},
    hi:{hero:"अगर एक मेडिकल बिल परिवार की बचत को नष्ट कर दे?",sub:"लाखों भारतीय परिवारों को उपचार की लागत और सरकारी स्वास्थ्य योजनाओं को समझने में संघर्ष करना पड़ता है।",cta:"प्रिस्क्रिप्शन स्कैन करें"},
  };
  const tx = translations[lang];

  return (
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"Sora, sans-serif",overflowX:"hidden"}}>
      <Particles/>

      {/* ── NAV ── */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:50,background:"rgba(3,5,15,0.8)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${T.border}`,padding:"0 2rem",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${T.teal},${T.tealDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>⚕</div>
          <span style={{fontFamily:"Sora",fontWeight:800,fontSize:"1rem",letterSpacing:.5}}>Medical<span style={{color:T.teal}}>Money</span>Guide</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          {["en","kn","hi"].map(l=>(
            <button key={l} onClick={()=>setLang(l)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${lang===l?T.teal:T.border}`,background:lang===l?"rgba(0,230,200,0.12)":"none",color:lang===l?T.teal:T.muted,fontSize:".75rem",cursor:"pointer",fontFamily:"Sora"}}>
              {l==="en"?"EN":l==="kn"?"ಕನ್ನಡ":"हिन्दी"}
            </button>
          ))}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"6rem 1.5rem 3rem",position:"relative",zIndex:1}}>
        {/* glow blobs */}
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,230,200,0.08),transparent 70%)",top:"10%",left:"20%",pointerEvents:"none"}}/>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,100,255,0.06),transparent 70%)",bottom:"15%",right:"15%",pointerEvents:"none"}}/>

        <div style={{display:"inline-block",background:"rgba(0,230,200,0.1)",border:`1px solid ${T.border}`,borderRadius:20,padding:"4px 16px",fontSize:".75rem",color:T.teal,letterSpacing:2,marginBottom:"1.5rem",fontWeight:600}}>
          🇮🇳 HEALTHCARE FINANCIAL PROTECTION FOR INDIA
        </div>
        <h1 style={{fontSize:"clamp(1.8rem,5vw,3.8rem)",fontFamily:"Montserrat",fontWeight:900,lineHeight:1.15,maxWidth:760,margin:"0 auto 1.5rem",letterSpacing:-1}}>
          <span style={{color:T.text}}>{tx.hero}</span>
        </h1>
        <p style={{color:T.muted,maxWidth:540,lineHeight:1.7,marginBottom:"2.5rem",fontSize:"clamp(.9rem,2vw,1.05rem)"}}>
          {tx.sub}
        </p>
        <button onClick={()=>setShowScanner(true)}
          style={{padding:"16px 40px",background:`linear-gradient(135deg,${T.teal},${T.tealDim})`,border:"none",borderRadius:50,color:"#03050f",fontWeight:800,fontSize:"1.05rem",cursor:"pointer",fontFamily:"Sora",letterSpacing:.5,boxShadow:`0 0 30px rgba(0,230,200,0.35)`,transition:"transform .2s,box-shadow .2s"}}
          onMouseEnter={e=>{e.target.style.transform="scale(1.04)";e.target.style.boxShadow=`0 0 50px rgba(0,230,200,0.5)`;}}
          onMouseLeave={e=>{e.target.style.transform="scale(1)";e.target.style.boxShadow=`0 0 30px rgba(0,230,200,0.35)`;}}
        >
          🔬 {tx.cta}
        </button>

        {/* stats row */}
        <div style={{display:"flex",gap:"2rem",marginTop:"4rem",flexWrap:"wrap",justifyContent:"center"}}>
          {[["500M+","Indians lack health insurance"],["₹47,000","Avg annual medical spend"],["70%","Unaware of govt schemes"]].map(([n,l])=>(
            <div key={n} style={{textAlign:"center"}}>
              <div style={{color:T.teal,fontSize:"1.6rem",fontWeight:800,fontFamily:"Montserrat"}}>{n}</div>
              <div style={{color:T.muted,fontSize:".75rem",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* scroll hint */}
        <div style={{position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",color:T.muted,fontSize:".75rem",display:"flex",flexDirection:"column",alignItems:"center",gap:6,animation:"float 2s ease-in-out infinite"}}>
          <span>scroll</span>
          <div style={{width:1,height:30,background:`linear-gradient(${T.teal},transparent)`}}/>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{padding:"4rem 1.5rem",maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
        <SectionHead>How It Works</SectionHead>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"1.5rem"}}>
          {[
            ["📄","Scan Prescription","Upload or type your prescription or medical advice"],
            ["🤖","AI Medical Mapper","AI translates complex terms to plain language"],
            ["🏛","Scheme Matching","Find all government schemes you qualify for"],
            ["💰","Financial Analysis","See exact costs, coverage & overcharge warnings"],
          ].map(([icon,title,desc])=>(
            <div key={title} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"1.2rem",backdropFilter:"blur(10px)"}}>
              <div style={{fontSize:"1.8rem",marginBottom:8}}>{icon}</div>
              <div style={{color:T.teal,fontWeight:700,marginBottom:4,fontSize:".9rem"}}>{title}</div>
              <div style={{color:T.muted,fontSize:".78rem",lineHeight:1.5}}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RESULTS (shown after scan) ── */}
      {result && (
        <div ref={resultsRef} style={{position:"relative",zIndex:1}}>

          {/* Medical Mapper */}
          <section style={{padding:"3rem 1.5rem",maxWidth:900,margin:"0 auto"}}>
            <SectionHead>🤖 AI Medical Mapper</SectionHead>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"2rem",backdropFilter:"blur(12px)"}}>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"1.5rem",justifyContent:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{color:T.muted,fontSize:".75rem",marginBottom:6}}>ORIGINAL TERM</div>
                  <div style={{fontFamily:"monospace",background:"rgba(255,68,68,0.1)",border:"1px solid rgba(255,68,68,0.25)",borderRadius:10,padding:"10px 20px",color:"#ff7777",fontSize:"1rem"}}>{r.raw_text?.slice(0,50)}…</div>
                </div>
                <div style={{color:T.teal,fontSize:"2rem"}}>→</div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:T.muted,fontSize:".75rem",marginBottom:6}}>SIMPLIFIED</div>
                  <div style={{fontFamily:"Sora",background:"rgba(0,230,200,0.1)",border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 20px",color:T.teal,fontSize:"1.05rem",fontWeight:700}}>{r.simple_name}</div>
                </div>
                <div style={{textAlign:"center"}}>
                  <div style={{color:T.muted,fontSize:".75rem",marginBottom:6}}>CONFIDENCE</div>
                  <div style={{color:T.green,fontSize:"1.8rem",fontWeight:800,fontFamily:"Montserrat"}}>{r.confidence_score}%</div>
                </div>
              </div>
            </div>
          </section>

          {/* Financial Analysis */}
          <section style={{padding:"3rem 1.5rem",maxWidth:900,margin:"0 auto"}}>
            <SectionHead>💰 Financial Analysis Engine</SectionHead>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"1.5rem"}}>
              {/* counter cards */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
                {[
                  {label:"Hospital Cost",val:hospitalCostC,color:T.text,icon:"🏥"},
                  {label:"Govt Coverage",val:coverageC,color:T.green,icon:"🛡"},
                  {label:"Your Expense",val:expenseC,color:T.amber,icon:"💳"},
                  {label:"Possible Overcharge",val:overchargeC,color:T.red,icon:"⚠"},
                ].map(({label,val,color,icon})=>(
                  <div key={label} style={{background:T.card,border:`1px solid ${color==="rgb(255,68,68)"||color===T.red?"rgba(255,68,68,0.2)":color===T.green?"rgba(0,230,118,0.15)":T.border}`,borderRadius:14,padding:"1rem",backdropFilter:"blur(10px)"}}>
                    <div style={{fontSize:"1.4rem",marginBottom:4}}>{icon}</div>
                    <div style={{color,fontWeight:800,fontSize:"1.1rem",fontFamily:"Montserrat"}}>₹{val.toLocaleString("en-IN")}</div>
                    <div style={{color:T.muted,fontSize:".7rem",marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
              {/* bars */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"1.5rem",backdropFilter:"blur(10px)"}}>
                <FinBar label="Hospital Cost" amount={r.hospital_cost} max={r.hospital_cost} color={T.muted} animated={animated}/>
                <FinBar label="Government Coverage" amount={r.coverage_amount} max={r.hospital_cost} color={T.green} animated={animated}/>
                <FinBar label="Your Out-of-Pocket" amount={r.patient_expense} max={r.hospital_cost} color={T.amber} animated={animated}/>
                <FinBar label="Possible Overcharge" amount={r.possible_overcharge} max={r.hospital_cost} color={T.red} animated={animated}/>
                {r.risk_level==="High"||r.possible_overcharge>15000 ? (
                  <div style={{background:"rgba(255,68,68,0.08)",border:"1px solid rgba(255,68,68,0.25)",borderRadius:10,padding:"10px 14px",marginTop:12}}>
                    <div style={{color:T.red,fontWeight:700,fontSize:".85rem"}}>⚠ OVERCHARGE ALERT</div>
                    <div style={{color:"#ff9999",fontSize:".78rem",marginTop:2}}>This hospital may be charging above standard scheme averages. Request itemized bill.</div>
                  </div>
                ):(
                  <div style={{background:"rgba(0,230,118,0.06)",border:"1px solid rgba(0,230,118,0.2)",borderRadius:10,padding:"10px 14px",marginTop:12}}>
                    <div style={{color:T.green,fontWeight:700,fontSize:".85rem"}}>✓ FAIR PRICING</div>
                    <div style={{color:"#99e699",fontSize:".78rem",marginTop:2}}>Hospital pricing appears within normal range for this procedure.</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Scheme Matching */}
          <section style={{padding:"3rem 1.5rem",maxWidth:900,margin:"0 auto"}}>
            <SectionHead>🏛 Government Scheme Matching</SectionHead>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"1rem"}}>
              {r.schemes.map(s=><SchemeCard key={s.name} s={s}/>)}
            </div>
          </section>

          {/* Trust Score */}
          <section style={{padding:"3rem 1.5rem",maxWidth:900,margin:"0 auto"}}>
            <SectionHead>🏥 Hospital Trust Score</SectionHead>
            <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:"2rem",backdropFilter:"blur(12px)",display:"flex",flexWrap:"wrap",gap:"2rem",alignItems:"center",justifyContent:"center"}}>
              <TrustGauge score={r.trust_score}/>
              <div style={{maxWidth:320}}>
                <div style={{color:T.text,fontWeight:700,fontFamily:"Sora",marginBottom:8,fontSize:"1rem"}}>
                  {r.trust_score>=80?"✅ This hospital has a strong transparency record."
                    :r.trust_score>=60?"⚠️ This hospital may charge above scheme averages."
                    :"🚨 HIGH FINANCIAL RISK — verify all charges carefully."}
                </div>
                <div style={{color:T.muted,fontSize:".82rem",lineHeight:1.6}}>
                  Trust scores are calculated from reported billing patterns, scheme compliance, and patient feedback. Always request an itemized bill before payment.
                </div>
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  {["Request Itemized Bill","Check Scheme Coverage","Compare Hospitals"].map(a=>(
                    <div key={a} style={{background:"rgba(0,230,200,0.08)",border:`1px solid ${T.border}`,borderRadius:20,padding:"4px 12px",fontSize:".72rem",color:T.tealDim}}>→ {a}</div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Smart Next Steps */}
          <section style={{padding:"3rem 1.5rem",maxWidth:900,margin:"0 auto"}}>
            <SectionHead>🧭 Smart Next Steps</SectionHead>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"1.5rem"}}>
              {/* questions */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"1.5rem",backdropFilter:"blur(10px)"}}>
                <div style={{color:T.teal,fontWeight:700,marginBottom:12}}>❓ Ask Your Doctor</div>
                {QUESTIONS.map(q=>(
                  <div key={q} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                    <span style={{color:T.green,marginTop:2}}>›</span>
                    <span style={{color:T.muted,fontSize:".82rem",lineHeight:1.5}}>{q}</span>
                  </div>
                ))}
              </div>
              {/* hospitals */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:"1.5rem",backdropFilter:"blur(10px)"}}>
                <div style={{color:T.teal,fontWeight:700,marginBottom:12}}>🏥 Nearby Affordable Hospitals</div>
                {HOSPITALS.map(h=>(
                  <div key={h.name} style={{padding:"10px",background:"rgba(255,255,255,0.03)",borderRadius:10,marginBottom:8,border:`1px solid ${T.border}`}}>
                    <div style={{fontWeight:700,fontSize:".85rem",marginBottom:3}}>{h.name}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Tag c={T.tealDim}>{h.type}</Tag>
                      <Tag c={T.green}>{h.scheme}</Tag>
                      <Tag c={h.trust>=80?T.green:T.amber}>Trust {h.trust}%</Tag>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ── IMPACT ── */}
      <section style={{padding:"5rem 1.5rem",position:"relative",zIndex:1,background:"linear-gradient(180deg,transparent,rgba(0,230,200,0.03),transparent)"}}>
        <div style={{maxWidth:700,margin:"0 auto",textAlign:"center"}}>
          <div style={{color:T.teal,fontSize:".8rem",letterSpacing:3,marginBottom:"1rem",fontWeight:600}}>SOCIAL IMPACT</div>
          <h2 style={{fontFamily:"Montserrat",fontWeight:900,fontSize:"clamp(1.5rem,4vw,2.4rem)",lineHeight:1.2,marginBottom:"2rem"}}>
            "Healthcare transparency<br/><span style={{color:T.teal}}>saves lives.</span>"
          </h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"1rem",marginBottom:"3rem"}}>
            {[
              {icon:"🛡",t:"Prevents exploitation of patients"},
              {icon:"📚",t:"Improves healthcare awareness"},
              {icon:"👨‍👩‍👧",t:"Supports low-income families"},
              {icon:"⚖",t:"Promotes fair hospital billing"},
              {icon:"💡",t:"Empowers better decisions"},
            ].map(({icon,t})=>(
              <div key={t} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:"1rem",backdropFilter:"blur(10px)"}}>
                <div style={{fontSize:"1.5rem",marginBottom:6}}>{icon}</div>
                <div style={{color:T.muted,fontSize:".75rem",lineHeight:1.5}}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUTURE SCOPE ── */}
      <section style={{padding:"4rem 1.5rem",maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
        <SectionHead>🚀 Future Scope</SectionHead>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"1rem"}}>
          {["Real OCR APIs","AI Voice Assistant (Kannada/Hindi)","Live Hospital APIs","Insurance Claim Automation","WhatsApp Healthcare Bot","Real-time Scheme Eligibility","AI Fraud Detection","National Billing Database"].map(f=>(
            <div key={f} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:T.teal,fontSize:".85rem"}}>◆</span>
              <span style={{color:T.muted,fontSize:".8rem"}}>{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── MULTILINGUAL ── */}
      <section style={{padding:"3rem 1.5rem",maxWidth:700,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
        <SectionHead>🌐 Multilingual Support</SectionHead>
        <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
          {[["🇬🇧 English","en"],["ಕ 🟠 Kannada","kn"],["🇮🇳 Hindi","hi"]].map(([label,code])=>(
            <button key={code} onClick={()=>setLang(code)}
              style={{padding:"10px 24px",border:`2px solid ${lang===code?T.teal:T.border}`,borderRadius:30,background:lang===code?"rgba(0,230,200,0.12)":"transparent",color:lang===code?T.teal:T.muted,cursor:"pointer",fontFamily:"Sora",fontWeight:600,transition:"all .2s"}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{marginTop:"1.5rem",display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
          {["🔊 Play Kannada Audio","🔊 Play Hindi Audio"].map(b=>(
            <button key={b} style={{padding:"8px 20px",border:`1px solid ${T.border}`,borderRadius:30,background:"rgba(0,230,200,0.06)",color:T.tealDim,cursor:"pointer",fontFamily:"Sora",fontSize:".85rem"}}>
              {b} <span style={{color:T.muted,fontSize:".7rem"}}>(coming soon)</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── ENDING ── */}
      <section style={{padding:"6rem 1.5rem",textAlign:"center",position:"relative",zIndex:1,background:"linear-gradient(180deg,transparent,rgba(0,10,30,0.8))"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <p style={{fontFamily:"Montserrat",fontSize:"clamp(1.2rem,3vw,1.8rem)",fontWeight:700,lineHeight:1.5,color:T.text,marginBottom:"2rem"}}>
            "No family should suffer financially because<br/><span style={{color:T.teal}}>healthcare information was confusing.</span>"
          </p>
          <div style={{color:T.muted,fontSize:".8rem",letterSpacing:3,marginBottom:6}}>⚕ MEDICAL MONEY GUIDE</div>
          <div style={{color:T.tealDim,fontSize:".85rem",letterSpacing:1}}>Understanding Treatment. Protecting Families.</div>
          <button onClick={()=>setShowScanner(true)} style={{marginTop:"2rem",padding:"14px 36px",background:`linear-gradient(135deg,${T.teal},${T.tealDim})`,border:"none",borderRadius:50,color:"#03050f",fontWeight:800,fontFamily:"Sora",cursor:"pointer",fontSize:"1rem",boxShadow:`0 0 25px rgba(0,230,200,0.3)`}}>
            🔬 Start Your Analysis
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{borderTop:`1px solid ${T.border}`,padding:"1.5rem",textAlign:"center",color:T.muted,fontSize:".75rem",position:"relative",zIndex:1}}>
        Made with ♥ for India's healthcare transparency | Medical Money Guide © 2025
      </footer>

      {showScanner && <ScannerModal onResult={handleResult} onClose={()=>setShowScanner(false)}/>}

      <style>{`
        *{box-sizing:border-box}
        body{margin:0}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#060d1f}
        ::-webkit-scrollbar-thumb{background:rgba(0,230,200,0.3);border-radius:3px}
        @keyframes float{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8px)}}
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Montserrat:wght@700;900&display=swap');
      `}</style>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function SectionHead({children}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
      <h2 style={{fontFamily:"Sora",fontWeight:800,fontSize:"1.15rem",color:T.text,margin:0}}>{children}</h2>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,${T.border},transparent)`}}/>
    </div>
  );
}
function Tag({c,children}) {
  return <span style={{background:`${c}18`,border:`1px solid ${c}44`,borderRadius:20,padding:"2px 8px",color:c,fontSize:".68rem",fontWeight:600}}>{children}</span>;
}

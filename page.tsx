"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Reading = { key: string; label: string; unit: string; range: string; values: string[] };
type Equipment = { unit: string; model: string; serial: string; readingTimes: string[]; readings: Reading[]; oilQuantity: string; comments: string; suggestion: string };
type ChecklistItem = { id: string; label: string; done: boolean; remarks: string };

const parameterSeed = [
  ["power_supply","Power supply","V","342 - 418"],
  ["oil_quantity","Oil quantity","Sign-Glass","Operating Range"],
  ["rla","RLA","%","0 - 100"],
  ["igv_position","IGV position","%","0 - 100"],
  ["ddc_position","DDC position","%","0 - 100"],
  ["run_hours_starts","Run hour / starts","h / starts",""],
  ["current","Compressor current","A","Model dependent"],
  ["set_point","Set point","°C","5 - 15"],
  ["evap_water_enter","Evaporator water – Enter","°C","5 - 20"],
  ["evap_water_leave","Evaporator water – Leave","°C","5 - 15"],
  ["evap_refrig_pressure","Evaporator refrigerant pressure","kPa","200 - 500"],
  ["evap_refrig_sat_temp","Evaporator refrigerant saturation temp.","°C",""],
  ["evap_refrig_suction_temp","Evaporator suction temperature","°C","4 - 25"],
  ["evap_refrig_superheat","Evaporator superheat","°C","0 - 4"],
  ["economizer_pressure","Economizer pressure","kPa",""],
  ["condenser_water_enter","Condenser water – Enter","°C","20 - 31"],
  ["condenser_water_leave","Condenser water – Leave","°C","20 - 36"],
  ["condenser_refrig_pressure","Condenser refrigerant pressure","kPa","500 - 965"],
  ["condenser_refrig_sat_temp","Condenser refrigerant saturation temp.","°C",""],
  ["condenser_refrig_discharge_temp","Discharge temperature","°C","35 - 80"],
  ["condenser_refrig_superheat","Condenser refrigerant superheat","°C",""],
  ["condenser_refrig_liquid_temp","Liquid temperature","°C","15 - 40"],
  ["condenser_refrig_subcooling","Sub cooling","°C","0 - 10"],
  ["liquid_level","Liquid level","%",""],
  ["exv_position","EXV position","%",""],
  ["oil_pressure_feed","Oil pressure – Feed","kPa",""],
  ["oil_pressure_net","Oil pressure – Net","kPa","≥ 152"],
  ["oil_pressure_sump","Oil pressure – Sump","kPa",""],
  ["oil_temp_feed","Oil temperature – Feed","°C","30 - 55"],
  ["oil_temp_sump","Oil temperature – Sump","°C","35 - 55"]
] as const;

const quarterlyLabels = [
  "Kiểm tra hoạt động toàn bộ tín hiệu bảo vệ với hệ thống liên kết bên ngoài /Check operation of all external electrical interlocks.",
  "Kiểm tra hoạt động và cài đặt thời gian tái khởi động/Check recycling timers, settings and operation.",
  "Kiểm tra hoạt động và cài đặt nhiệt độ tái khởi động/Check recycling thermostat settings and operation.",
  "Kiểm tra độ chênh áp của dàn bay hơi so với thiết kế/Check evaporator water pressure drops values against design quantities.",
  "Kiểm tra đảm bảo áp suất hút, nén và nhớt ở điều kiện hoạt động bình thường/Insure suction, discharge and oil pressure normal.",
  "Kiểm tra độ siêu nhiệt đường hút/Check for correct suction superheat readings.",
  "Kiểm tra độ chênh nhiệt đường gas lỏng/Check for correct liquid sub cooling.",
  "Kiểm tra màu và mực nhớt bôi trơn trong bầu chứa dầu của máy nén/Check condition and level of lubricating oil in compressor reservoir.",
  "Kiểm tra hoạt động của điện trở sưởi máy nén/Check operation of compressor crankcase heaters.",
  "Kiểm tra đảm bảo dòng chạy của máy nén tương ứng với tải/Insure compressor electrical current draw corresponds to load conditions.",
  "Kiểm tra chế độ vận hành của bộ điều khiển/Check operation of controller.",
  "Kiểm tra tình trạng của phin lọc ẩm/Check condition of refrigerant filter drier.",
  "Kiểm tra độ ẩm của gas lạnh/Check condition of refrigerant moisture indicator.",
  "Thử xì toàn bộ hệ thống tổng quan bên ngoài/Leak test refrigerant systems (external only).",
  "Kiểm tra mực gas đã nạp trong điều kiện hoạt động/Check refrigerant charge level.",
  "Kiểm tra độ chênh nhiệt dàn lạnh nhằm xác định tình trạng hoạt động của dàn bay hơi/Check evaporator approach temperature to determine effective heat exchange condition.",
  "Kiểm tra tình trạng dàn giải nhiệt/Check condition of condenser.",
  "Kiểm tra các đầu nối và siết chặt nếu cần/Check terminals for tightness, tighten as necessary.",
  "Bằng trực quan kiểm tra các dấu hiệu quá nhiệt của các bộ phận trên chiller/Visually inspect components for signs of overheating.",
  "Kiểm tra hoạt động đèn hiển thị/Verify operation of indicator lights.",
  "Kiểm tra nhiệt độ vào và ra dàn bay hơi/Check temperatures of supply chilled water and return chilled water.",
  "Kiểm tra tình trạng cách nhiệt của chiller (báo giá sửa chữa khi cần)/Inspect thermal insulation for integrity (to be quoted as necessary)",
  "Vệ sinh và sơn lại thiết bị khi cần thiết (Báo giá khi cần thiết)/Clean and paint as required (to be quoted as necessary).",
  "Bằng trực quan kiểm tra các bộ phận của chiller lỏng lẻo hay hư hỏng/Visually inspect unit for loose or damaged components.",
  "Kiểm tra tòan bộ lỗi của chiller trong lịch sử báo lỗi để xác định nguyên nhân hư hỏng/Check all alarm in alarm history to determine the cause."
];
const annualLabels = [
  "Kiểm tra hoạt động của công tắc áp suất cao (công tắc cao áp và tích hợp cảm biến áp lực cao) / Verify operation of high pressure Switch.",
  "Kiểm tra hoạt động của công tắc áp suất thấp (tích hợp cảm biến áp lực thấp) / Verify operation of low pressure Switch.",
  "Thay nhớt máy nén và các gasket liên quan/ Replace compressor oil and the relevant gaskets as necessary.",
  "Phân tích dầu (báo giá khi cần thiết)/ Conduct oil analysis (to be quoted as necessary).",
  "Phụ tùng báo giá riêng biệt nếu cần thiết/ Spare part are quoted separately",
  "Kiểm tra tất cả các giá trị cài đặt, điều chỉnh khi cần/ Check all service set-point, adjust if necessary.",
  "Kiểm tra đánh giá các hư hỏng của các tiếp điểm của khởi động từ (kiểm tra bằng scan nhiệt độ)/ Inspect contactors for wear and tear, particularly on contact tips.",
  "Kiểm tra toàn bộ các đầu nối, siết lại khi cần thiết (sẽ được báo giá khi có yêu cầu thay thế)/ Inspect all electrical connection tighten as necessary. (To be quoted as replacement required).",
  "Vệ sinh bên trong các tủ điều khiển/ Clean control panel interior.",
  "Kiểm tra đánh giá các đầu nối cho việc ăn mòn hay nứt, vệ sinh các đầu kết nối/ Inspect terminals for cracks and corrosion, clean terminals.",
  "Kiểm tra độ cách điện cho máy nén và cáp ở giá trị 500V/ Perform 500V insulation test on the compressor motor and power cables.",
  "Kiểm tra tình trạng hoạt động của các thiết bị bảo vệ/ Test operation of protective controls.",
  "Kiểm tra rung động của chiller (báo giá khi có yêu cầu)/Conduct vibration test on chiller (to be quote as replacement required)",
  "Nạp lại gas sau khi thay dầu mới/Re fill up refrigerant after replace new oil",
  "Phụ tùng báo giá riêng biệt nếu yêu cầu/ Spare part are quote separately",
  "Vệ sinh ống dàn ngưng với máy và nước/ Cleaning of condenser tube with machine & water (repair the fins to be quoted as necessary)"
];

function makeEquipment(n: number): Equipment {
  return {
    unit: `CH${n}`, model: "", serial: "",
    readingTimes: ["", ""], oilQuantity: "",
    readings: parameterSeed.map(([key,label,unit,range]) => ({key,label,unit,range,values:["",""]})),
    comments: "", suggestion: ""
  };
}
function makeChecks(labels: string[], prefix: string): ChecklistItem[] {
  return labels.map((label,i)=>({id:`${prefix}_${i+1}`,label,done:false,remarks:""}));
}
function fileToBase64(file: File): Promise<{name:string; mime:string; data:string}> {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve({name:file.name,mime:file.type,data:String(reader.result).split(",")[1] || ""});
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

export default function Home() {
  const [user,setUser] = useState<User|null>(null);
  const [authReady,setAuthReady] = useState(false);
  const [authEmail,setAuthEmail] = useState("");
  const [authPassword,setAuthPassword] = useState("");
  const [authMode,setAuthMode] = useState<"login"|"signup">("login");
  const [reportId,setReportId] = useState<string|null>(null);
  const [form,setForm] = useState({
    contractNo:"", customer:"", maintenanceType:"quarterly", dateFrom:"", dateTo:"",
    content:"", serviceCenter:"SERVICE CENTER – HO CHI MINH CITY", address:"100-102 Vu Tong Phan St, An Phu Ward, Thu Duc city, HCM City.",
    hotline:"1900 6777", apHotline:"077 365 8789", conclusion:"", generalSuggestion:"",
    reportBy:"", witnessBy:""
  });
  const [equipment,setEquipment] = useState<Equipment[]>([makeEquipment(1),makeEquipment(2),makeEquipment(3)]);
  const [quarterly,setQuarterly] = useState(()=>makeChecks(quarterlyLabels,"quarterly"));
  const [annual,setAnnual] = useState(()=>makeChecks(annualLabels,"annual"));
  const [photos,setPhotos] = useState<{name:string;mime:string;data:string}[]>([]);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [active,setActive] = useState("general");

  useEffect(()=>{
    if(!supabase){ setAuthReady(true); return; }
    supabase.auth.getSession().then(({data})=>{ setUser(data.session?.user ?? null); setAuthReady(true); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user ?? null));
    return ()=>subscription.unsubscribe();
  },[]);

  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const updateForm = (key:string,value:string) => setForm(prev=>({...prev,[key]:value}));
  const updateEquipment = (index:number, patch:Partial<Equipment>) =>
    setEquipment(prev=>prev.map((e,i)=>i===index?{...e,...patch}:e));
  const updateReading = (ei:number,ri:number,vi:number,value:string) =>
    setEquipment(prev=>prev.map((e,i)=>i!==ei?e:{...e,readings:e.readings.map((r,j)=>j!==ri?r:{...r,values:r.values.map((v,k)=>k===vi?value:v)})}));
  const updateCheck = (type:"quarterly"|"annual", id:string, patch:Partial<ChecklistItem>) => {
    const setter = type==="quarterly"?setQuarterly:setAnnual;
    setter(prev=>prev.map(x=>x.id===id?{...x,...patch}:x));
  };
  const addEquipment = () => setEquipment(prev=>[...prev,makeEquipment(prev.length+1)]);
  const removeEquipment = (index:number) => setEquipment(prev=>prev.filter((_,i)=>i!==index).map((e,i)=>({...e,unit:`CH${i+1}`})));

  async function generate() {
    setBusy(true); setMessage("");
    try {
      const payload = {...form,equipment,quarterlyChecklist:quarterly,annualChecklist:annual,photos};
      const res = await fetch(`${api}/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href=url; a.download=`Maintenance_Report_${(form.customer||"Customer").replace(/[^a-z0-9_-]/gi,"_")}.docx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setMessage("Word report generated. Please review the document before issuing it.");
    } catch(err) {
      setMessage(`Generation failed: ${err instanceof Error?err.message:"Unknown error"}. Check that the backend is running.`);
    } finally { setBusy(false); }
  }

  async function addPhotos(files:FileList|null) {
    if(!files) return;
    const items = await Promise.all(Array.from(files).map(fileToBase64));
    setPhotos(prev=>[...prev,...items]);
  }

  async function authenticate() {
    if(!supabase){ setMessage("Supabase is not configured. Add the two NEXT_PUBLIC_SUPABASE variables in your environment."); return; }
    setBusy(true); setMessage("");
    try {
      const result = authMode==="login"
        ? await supabase.auth.signInWithPassword({email:authEmail,password:authPassword})
        : await supabase.auth.signUp({email:authEmail,password:authPassword});
      if(result.error) throw result.error;
      if(authMode==="signup" && !result.data.session) setMessage("Account created. Check your email to confirm the account, then sign in.");
      else setMessage("Signed in successfully.");
    } catch(err) { setMessage(err instanceof Error?err.message:"Authentication failed."); }
    finally { setBusy(false); }
  }

  async function saveDraft() {
    if(!supabase || !user) return;
    setBusy(true); setMessage("");
    try {
      const id = reportId || crypto.randomUUID();
      let oldPhotoPaths: string[] = [];
      if(reportId){
        const {data:oldReport}=await supabase.from("maintenance_reports").select("form_payload").eq("id",reportId).maybeSingle();
        oldPhotoPaths=((oldReport?.form_payload as any)?.photos||[]).map((x:{path:string})=>x.path).filter(Boolean);
      }
      const photoMeta: {name:string;mime:string;path:string}[] = [];
      for(let i=0;i<photos.length;i++){
        const photo=photos[i];
        const safeName=photo.name.replace(/[^a-z0-9._-]/gi,"_");
        const path=`${user.id}/${id}/${i}-${safeName}`;
        const bytes=Uint8Array.from(atob(photo.data),c=>c.charCodeAt(0));
        const {error:uploadError}=await supabase.storage.from("report-photos").upload(path,bytes,{contentType:photo.mime||"image/jpeg",upsert:true});
        if(uploadError) throw uploadError;
        photoMeta.push({name:photo.name,mime:photo.mime,path});
      }
      const formPayload={form,equipment,quarterly,annual,photos:photoMeta};
      const {error}=await supabase.from("maintenance_reports").upsert({
        id, customer_name:form.customer.trim()||"Untitled report", contract_no:form.contractNo,
        maintenance_type:form.maintenanceType, date_from:form.dateFrom, date_to:form.dateTo,
        service_center:form.serviceCenter,address:form.address,hotline:form.hotline,ap_hotline:form.apHotline,
        content:form.content,conclusion:form.conclusion,general_suggestion:form.generalSuggestion,
        report_by:form.reportBy,witness_by:form.witnessBy,status:"draft",form_payload:formPayload,
        created_by:user.id,updated_by:user.id,updated_at:new Date().toISOString()
      });
      if(error) throw error;
      const currentPaths=new Set(photoMeta.map(x=>x.path));
      const obsoletePaths=oldPhotoPaths.filter(path=>!currentPaths.has(path));
      if(obsoletePaths.length) await supabase.storage.from("report-photos").remove(obsoletePaths);
      setReportId(id); setMessage("Draft saved securely to your Supabase account.");
    } catch(err) { setMessage(`Could not save draft: ${err instanceof Error?err.message:"Unknown error"}`); }
    finally { setBusy(false); }
  }

  async function loadLatestDraft() {
    if(!supabase || !user) return;
    setBusy(true); setMessage("");
    try {
      const {data,error}=await supabase.from("maintenance_reports").select("id,form_payload").eq("created_by",user.id).order("updated_at",{ascending:false}).limit(1).maybeSingle();
      if(error) throw error;
      if(!data){ setMessage("No saved report was found for this account."); return; }
      const p=data.form_payload as any;
      if(p.form) setForm(p.form);
      if(Array.isArray(p.equipment)) setEquipment(p.equipment);
      if(Array.isArray(p.quarterly)) setQuarterly(p.quarterly);
      if(Array.isArray(p.annual)) setAnnual(p.annual);
      const restored: {name:string;mime:string;data:string}[]=[];
      for(const photo of (p.photos||[])){
        const {data:file,error:downloadError}=await supabase.storage.from("report-photos").download(photo.path);
        if(downloadError) throw downloadError;
        restored.push({name:photo.name,mime:photo.mime,data:await blobToBase64(file)});
      }
      setPhotos(restored); setReportId(data.id); setMessage("Latest saved report loaded.");
    } catch(err) { setMessage(`Could not load report: ${err instanceof Error?err.message:"Unknown error"}`); }
    finally { setBusy(false); }
  }

  function newReport() {
    setReportId(null);
    setForm({contractNo:"",customer:"",maintenanceType:"quarterly",dateFrom:"",dateTo:"",content:"",serviceCenter:"SERVICE CENTER – HO CHI MINH CITY",address:"100-102 Vu Tong Phan St, An Phu Ward, Thu Duc city, HCM City.",hotline:"1900 6777",apHotline:"077 365 8789",conclusion:"",generalSuggestion:"",reportBy:"",witnessBy:""});
    setEquipment([makeEquipment(1),makeEquipment(2),makeEquipment(3)]);
    setQuarterly(makeChecks(quarterlyLabels,"quarterly")); setAnnual(makeChecks(annualLabels,"annual"));
    setPhotos([]); setMessage("New report started. Save it when ready."); setActive("general");
  }

  async function signOut() { newReport(); if(supabase) await supabase.auth.signOut(); }

  if(!authReady) return <main className="shell"><div className="card">Loading account…</div></main>;
  if(!user) return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">TECHNICAL SERVICE</div><h1>Maintenance Report Generator</h1><p>Sign in to save and retrieve maintenance reports.</p>{!supabase&&<div className="alert error">Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</div>}<label>Email<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="name@company.com"/></label><label>Password<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="primary" onClick={authenticate} disabled={busy||!supabase||!authEmail||!authPassword}>{busy?"Please wait…":authMode==="login"?"Sign in":"Create account"}</button><button className="link" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>{authMode==="login"?"Create a new account":"Back to sign in"}</button>{message&&<div className="alert">{message}</div>}</div></main>;

  const tabs = [
    ["general","General information"],["equipment","Equipment"],["photos","Photos"],
    ["quarterly","Quarterly checklist"],["annual","Annual shutdown"],["logsheets","Technical logsheets"],["closing","Conclusion & signatures"]
  ];
  return <main className="shell">
    <header className="topbar">
      <div><div className="eyebrow">TECHNICAL SERVICE</div><h1>Maintenance Report Generator</h1><p>Create a maintenance report and generate an editable Word document.</p></div>
      <div className="top-actions"><span className="draft">{reportId?"Saved draft":"Draft"}</span><button className="secondary" onClick={newReport} disabled={busy}>New report</button><button className="secondary" onClick={loadLatestDraft} disabled={busy}>Load latest</button><button className="secondary" onClick={saveDraft} disabled={busy}>Save draft</button><button className="primary" onClick={generate} disabled={busy}>{busy?"Working…":"Generate Word report"}</button><button className="link" onClick={signOut}>Sign out</button></div>
    </header>
    <div className="layout">
      <aside className="sidebar"><div className="side-title">REPORT SECTIONS</div>{tabs.map(([id,label],i)=><button key={id} className={`nav ${active===id?"selected":""}`} onClick={()=>setActive(id)}><span>{String(i+1).padStart(2,"0")}</span>{label}</button>)}
      <div className="side-note">Original template: ESTELLA maintenance report, 8 pages.</div></aside>
      <section className="content">
        {active==="general"&&<><div className="section-head"><div><div className="eyebrow">SECTION 01</div><h2>General information</h2><p>Customer, contract and maintenance details.</p></div></div>
          <div className="card form-grid">
            <Field label="Contract No." value={form.contractNo} onChange={v=>updateForm("contractNo",v)}/>
            <Field label="Customer / Project" value={form.customer} onChange={v=>updateForm("customer",v)} placeholder="Customer or project name"/>
            <label>Maintenance type<select value={form.maintenanceType} onChange={e=>updateForm("maintenanceType",e.target.value)}><option value="quarterly">Quarterly maintenance inspection</option><option value="annual">Annual shutdown</option><option value="both">Quarterly + annual</option></select></label>
            <Field label="From date" value={form.dateFrom} onChange={v=>updateForm("dateFrom",v)} placeholder="e.g. 21 June 2026"/>
            <Field label="To date" value={form.dateTo} onChange={v=>updateForm("dateTo",v)} placeholder="e.g. 28 June 2026"/>
            <Field label="Service center" value={form.serviceCenter} onChange={v=>updateForm("serviceCenter",v)}/>
            <Field label="Address" value={form.address} onChange={v=>updateForm("address",v)}/>
            <Field label="Hotline" value={form.hotline} onChange={v=>updateForm("hotline",v)}/>
            <Field label="AP Hotline" value={form.apHotline} onChange={v=>updateForm("apHotline",v)}/>
            <label className="full">Maintenance content<textarea rows={4} value={form.content} onChange={e=>updateForm("content",e.target.value)} placeholder="Describe the work performed..."/></label>
          </div></>}
        {active==="equipment"&&<><div className="section-head"><div><div className="eyebrow">SECTION 02</div><h2>Equipment information</h2><p>Add all chillers included in this report.</p></div><button className="secondary" onClick={addEquipment}>＋ Add chiller</button></div>
          {equipment.map((e,i)=><div className="card equipment-card" key={i}><div className="card-title"><strong>{e.unit}</strong><button className="link danger" onClick={()=>removeEquipment(i)} disabled={equipment.length===1}>Remove</button></div><div className="form-grid"><Field label="Unit name" value={e.unit} onChange={v=>updateEquipment(i,{unit:v})}/><Field label="Model" value={e.model} onChange={v=>updateEquipment(i,{model:v})}/><Field label="Serial number" value={e.serial} onChange={v=>updateEquipment(i,{serial:v})}/></div></div>)}</>}
        {active==="photos"&&<><div className="section-head"><div><div className="eyebrow">SECTION 03</div><h2>Picture of works</h2><p>Upload site photos to insert into the original report.</p></div></div><div className="card"><label className="upload">＋ Choose photos<input type="file" accept="image/png,image/jpeg" multiple onChange={e=>addPhotos(e.target.files)}/></label><div className="photo-list">{photos.map((p,i)=><div className="photo-row" key={i}><span>▧ {p.name}</span><button className="link danger" onClick={()=>setPhotos(prev=>prev.filter((_,j)=>j!==i))}>Remove</button></div>)}</div><p className="muted">JPG and PNG. Keep total upload size reasonable for the API request.</p></div></>}
        {active==="quarterly"&&<Checklist title="Quarterly maintenance inspection" items={quarterly} onChange={(id,p)=>updateCheck("quarterly",id,p)}/>}
        {active==="annual"&&<Checklist title="Annual shutdown" items={annual} onChange={(id,p)=>updateCheck("annual",id,p)}/>}
        {active==="logsheets"&&<><div className="section-head"><div><div className="eyebrow">SECTION 05</div><h2>Technical logsheets</h2><p>Enter readings for each chiller. The Word template has two reading columns; additional readings are grouped in the second column.</p></div></div>
          {equipment.map((e,ei)=><div className="card log-card" key={ei}><div className="card-title"><div><strong>{e.unit} – {e.model||"Model not specified"}</strong><div className="muted">{e.serial}</div></div><button className="secondary small" onClick={()=>updateEquipment(ei,{readingTimes:[...e.readingTimes,""] ,readings:e.readings.map(r=>({...r,values:[...r.values,""]}))})}>＋ Add reading</button></div>
            <div className="time-grid"><div className="param-label">Parameter / unit / range</div>{e.readingTimes.map((t,ri)=><input key={ri} placeholder={`Reading ${ri+1} date / time`} value={t} onChange={ev=>updateEquipment(ei,{readingTimes:e.readingTimes.map((x,j)=>j===ri?ev.target.value:x)})}/>)}</div>
            <div className="readings">{e.readings.map((r,ri)=><div className="reading-row" key={r.key}><div><b>{r.label}</b><small>{r.unit} · Range: {r.range||"Not specified"}</small></div>{r.values.map((v,vi)=><input key={vi} value={v} onChange={ev=>updateReading(ei,ri,vi,ev.target.value)} placeholder="—"/>)}</div>)}</div>
            <div className="form-grid"><label>Oil quantity / sight glass<input value={e.oilQuantity} onChange={ev=>updateEquipment(ei,{oilQuantity:ev.target.value})} placeholder="Operating range"/></label><label>Comments<textarea rows={2} value={e.comments} onChange={ev=>updateEquipment(ei,{comments:ev.target.value})}/></label><label className="full">Suggestion<textarea rows={2} value={e.suggestion} onChange={ev=>updateEquipment(ei,{suggestion:ev.target.value})}/></label></div>
          </div>)}</>}
        {active==="closing"&&<><div className="section-head"><div><div className="eyebrow">SECTION 06–07</div><h2>Conclusion & signatures</h2><p>Final condition, recommendations and signatories.</p></div></div><div className="card form-grid"><label className="full">Conclusion<textarea rows={4} value={form.conclusion} onChange={e=>updateForm("conclusion",e.target.value)} placeholder="Summarize the condition of the equipment..."/></label><label className="full">General suggestions<textarea rows={4} value={form.generalSuggestion} onChange={e=>updateForm("generalSuggestion",e.target.value)} placeholder="Recommendations and follow-up actions..."/></label><Field label="Report prepared by" value={form.reportBy} onChange={v=>updateForm("reportBy",v)}/><Field label="Witnessed by" value={form.witnessBy} onChange={v=>updateForm("witnessBy",v)}/></div></>}
        <div className="bottom-bar"><span className="muted">Save your draft to Supabase before leaving the page.</span><button className="primary" onClick={generate} disabled={busy}>{busy?"Generating...":"Generate editable Word report →"}</button></div>
        {message&&<div className={message.startsWith("Generation failed")?"alert error":"alert"}>{message}</div>}
      </section>
    </div>
  </main>;
}

function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}) {
  return <label>{label}<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>;
}
function Checklist({title,items,onChange}:{title:string;items:ChecklistItem[];onChange:(id:string,p:Partial<ChecklistItem>)=>void}) {
  return <><div className="section-head"><div><div className="eyebrow">SECTION 04</div><h2>{title}</h2><p>Tick only work actually completed. Add remarks when necessary.</p></div></div><div className="card checklist">{items.map((item,i)=><div className="check-row" key={item.id}><label className="check-label"><input type="checkbox" checked={item.done} onChange={e=>onChange(item.id,{done:e.target.checked})}/><span>{item.label}</span></label><input className="remarks" placeholder="Remarks (optional)" value={item.remarks} onChange={e=>onChange(item.id,{remarks:e.target.value})}/></div>)}</div></>;
}

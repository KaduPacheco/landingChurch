import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { DEFAULT_N8N_WEBHOOK_URL, getClientIp, getSupabaseClient, leadSchema, saveLead, sendLeadToWebhook, updateLeadWebhookStatus } from "./lib/leads.js";
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const {PORT="3000",SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,ALLOWED_ORIGINS="",N8N_WEBHOOK_URL=DEFAULT_N8N_WEBHOOK_URL}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY) console.warn("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to persist leads.");
const app=express(), supabase=getSupabaseClient(), allowedOrigins=ALLOWED_ORIGINS.split(",").map(x=>x.trim()).filter(Boolean);
app.set("trust proxy",1); app.use(helmet()); app.use(express.json({limit:"32kb"})); app.use(cors({origin(origin,cb){cb(null,!origin||(allowedOrigins.length>0&&allowedOrigins.includes(origin)))}}));
app.get("/health",(_q,r)=>r.json({ok:true}));
app.post("/api/leads",rateLimit({windowMs:900000,limit:20,standardHeaders:true,legacyHeaders:false}),async(req,res)=>{
 if(!supabase)return res.status(503).json({error:"Supabase is not configured."}); const parsed=leadSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Invalid lead data.",details:parsed.error.flatten().fieldErrors}); const lead=parsed.data; if(lead.companyWebsite)return res.status(202).json({ok:true});
 try { const {data:savedLead,error}=await saveLead({supabase,lead,userAgent:req.get("user-agent"),ipAddress:getClientIp(req.headers,req.socket.remoteAddress)}); if(error){console.error("Failed to insert demo lead",error);return res.status(500).json({error:"Could not save lead."})} try {await sendLeadToWebhook({lead,leadId:savedLead.id,webhookUrl:N8N_WEBHOOK_URL});await updateLeadWebhookStatus({supabase,leadId:savedLead.id,status:"sent"})}catch(webhookError){console.error("Failed to send lead to n8n",webhookError);await updateLeadWebhookStatus({supabase,leadId:savedLead.id,status:"failed",error:webhookError instanceof Error?webhookError.message:"Unknown webhook error"})} return res.status(201).json({ok:true}) }catch(error){console.error("Unexpected lead submission error",error);return res.status(500).json({error:"Could not save lead."})}
});
const files=new Map([["/","index.html"],["/index","index.html"],["/index.html","index.html"],["/privacidade","privacidade.html"],["/privacidade.html","privacidade.html"],["/termos","termos.html"],["/termos.html","termos.html"],["/obrigado","obrigado.html"],["/obrigado.html","obrigado.html"],["/styles.css","styles.css"],["/script.js","script.js"],["/analytics.js","analytics.js"],["/analytics-config.js","analytics-config.js"]]);
app.use("/assets",express.static(path.join(__dirname,"assets"),{dotfiles:"deny",fallthrough:false,index:false}));app.get([...files.keys()],(q,r)=>r.sendFile(path.join(__dirname,files.get(q.path))));app.listen(Number(PORT),()=>console.log("SimpleChurch landing backend running on http://localhost:"+PORT));

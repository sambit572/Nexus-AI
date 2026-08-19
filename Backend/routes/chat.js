 import express from "express";
 import multer from "multer";
 import Thread from "../models/Thread.js";
 import getNexusAiApiResponse from "../utils/nexuai.js";
 import { chatLimiter } from "../middleware/rateLimiter.js";
 import { PERSONAS, DEFAULT_PERSONA } from "../utils/personas.js";
 import authMiddleware from "../middleware/auth.js";

 const router=express.Router();

 // Every route below deals with a signed-in user's own threads, so require
 // a valid token for all of them.
 router.use(authMiddleware);

 // Images are kept in memory just long enough to base64-encode them for
 // Gemini and store a data URL in Mongo - nothing is written to disk.
 const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB per image
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed."));
        }
        cb(null, true);
    }
 });

 //to get all Chat (scoped to the logged-in user)
 router.get("/thread",async(req,res)=>{
    try{
        const threads=await Thread.find({userId:req.user.id}).sort({updatedAt:-1});
        res.json(threads);
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to Fetch"});
    }
 });

 //to get information of a perticular user
 router.get("/thread/:threadId",async(req,res)=>{
    const {threadId}=req.params;
    try{
        const thread=await Thread.findOne({threadId,userId:req.user.id});
        if(!thread){
            return res.status(404).json({error:"thread not found"});
        }
        res.json(thread.messages);
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to find Chat"});
    }
});

 //to delete a chat
 router.delete("/thread/:threadId",async(req,res)=>{
    const {threadId}=req.params;
    try{
        const deletedThread=await Thread.findOneAndDelete({threadId,userId:req.user.id});
        if(!deletedThread){
            res.status(404).json({error:"thread could not be deleted"});
        }
        res.status(200).json({success:"thread deleted successfully"});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to delete Chat"});
    }
 });

 //to get available personas
 router.get("/personas",(req,res)=>{
    const list = Object.entries(PERSONAS).map(([id,p])=>({
        id,
        name: p.name,
        description: p.description,
        icon: p.icon
    }));
    res.json({ personas:list, default: DEFAULT_PERSONA });
 });

 //to get resonse,post route
 router.post("/chat",chatLimiter,(req,res,next)=>{
    // Wrap multer so a bad/oversized image returns a clean JSON 400
    // instead of an unhandled exception.
    upload.single("image")(req,res,(err)=>{
        if(err){
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "Image is too large. Please upload an image under 4MB."
                : err.message || "Failed to process the uploaded image.";
            return res.status(400).json({error:message});
        }
        next();
    });
 },async(req,res)=>{
    const {threadId,message,persona}=req.body;
    const imageFile=req.file;

    if(!threadId || (!message && !imageFile)){
        return res.status(400).json({error:"missing require fields"});
    }

    // Fall back to the default persona for unknown/missing ids instead of
    // erroring out, so older frontend builds without persona support still work.
    const personaId = PERSONAS[persona] ? persona : DEFAULT_PERSONA;
    const systemPrompt = PERSONAS[personaId].systemPrompt;

    // Build the base64 image payload (if any) once, so it can be reused
    // both for the Gemini call and for what we persist to Mongo.
    let imagePayload=null;
    let imageDataUrl=null;
    if(imageFile){
        const base64Data=imageFile.buffer.toString("base64");
        imagePayload={ mimeType:imageFile.mimetype, data:base64Data };
        imageDataUrl=`data:${imageFile.mimetype};base64,${base64Data}`;
    }

    try{
        let thread=await Thread.findOne({threadId,userId:req.user.id});
        const userMessage={
            role:"user",
            content: message || "(sent an image)",
            image: imageDataUrl
        };

        if(!thread){
            thread=new Thread({
               threadId,
               userId: req.user.id,
               title: message || "Image chat",
               persona: personaId,
               messages:[userMessage]
            });
        } else {
            thread.messages.push(userMessage);
        }

        const geminiReplay=await getNexusAiApiResponse(message, imagePayload, systemPrompt);
        thread.messages.push({role:"assitant",content:geminiReplay});
        thread.updatedAt=new Date();
        await thread.save();
        res.json({reply:geminiReplay});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Something Went Wrong"});
    }
 });

export default router;     
 import express from "express";
 import multer from "multer";
 import Thread from "../models/Thread.js";
 import getNexusAiApiResponse from "../utils/nexuai.js";
 import { chatLimiter } from "../middleware/rateLimiter.js";
 import { PERSONAS, DEFAULT_PERSONA } from "../utils/personas.js";
 import { RESPONSE_STYLES, RESPONSE_STYLE_LIST } from "../utils/responseStyles.js";
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
        res.json({ messages: thread.messages, responseStyle: thread.responseStyle || null });
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

 //to get the list of folders in use (plus default suggestions), with counts
 router.get("/folders",async(req,res)=>{
    try{
        const DEFAULT_FOLDERS = ["General","Work","Study","Personal"];

        const counts = await Thread.aggregate([
            { $match: { userId: req.user.id } },
            { $group: { _id: "$folder", count: { $sum: 1 } } }
        ]);

        const countMap = {};
        counts.forEach(c => { countMap[c._id || "General"] = c.count; });

        // Always surface the default folders even if empty, plus any
        // custom folder names the user has actually used.
        const allNames = new Set([...DEFAULT_FOLDERS, ...Object.keys(countMap)]);

        const folders = Array.from(allNames).map(name => ({
            name,
            count: countMap[name] || 0,
            isDefault: DEFAULT_FOLDERS.includes(name)
        }));

        // Defaults first (in fixed order), then custom folders alphabetically
        folders.sort((a,b)=>{
            if(a.isDefault && b.isDefault) return DEFAULT_FOLDERS.indexOf(a.name) - DEFAULT_FOLDERS.indexOf(b.name);
            if(a.isDefault) return -1;
            if(b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });

        res.json(folders);
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to fetch folders"});
    }
 });

 //to move a thread into a folder (creates the folder implicitly if it's new)
 router.patch("/thread/:threadId/folder",async(req,res)=>{
    const {threadId}=req.params;
    const {folder}=req.body;

    if(!folder || !folder.trim()){
        return res.status(400).json({error:"folder name is required"});
    }

    try{
        const thread=await Thread.findOneAndUpdate(
            {threadId,userId:req.user.id},
            {folder: folder.trim()},
            {new:true}
        );
        if(!thread){
            return res.status(404).json({error:"thread not found"});
        }
        res.json({threadId: thread.threadId, folder: thread.folder});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to move thread"});
    }
 });

 //to get the available side-by-side response styles
 router.get("/response-styles",(req,res)=>{
    res.json({ styles: RESPONSE_STYLE_LIST });
 });

 //to explicitly set/reset a thread's locked response style
 //(style: "A" | "B" locks it, null sends it back to side-by-side comparison mode)
 router.patch("/thread/:threadId/style",async(req,res)=>{
    const {threadId}=req.params;
    const {style}=req.body;

    if(style!==null && style!==undefined && !RESPONSE_STYLES[style]){
        return res.status(400).json({error:"style must be 'A', 'B', or null"});
    }

    try{
        const thread=await Thread.findOneAndUpdate(
            {threadId,userId:req.user.id},
            {responseStyle: style ?? null},
            {new:true}
        );
        if(!thread){
            return res.status(404).json({error:"thread not found"});
        }
        res.json({threadId: thread.threadId, responseStyle: thread.responseStyle});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to update response style"});
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
    const {threadId,message,persona,folder}=req.body;
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

        // A thread with no style locked in yet (including brand-new threads)
        // stays in side-by-side comparison mode until the user picks one.
        const effectiveStyle = thread?.responseStyle || null;

        if(!thread){
            thread=new Thread({
               threadId,
               userId: req.user.id,
               title: message || "Image chat",
               persona: personaId,
               folder: folder && folder.trim() ? folder.trim() : "General",
               messages:[userMessage]
            });
        } else {
            thread.messages.push(userMessage);
        }

        if(effectiveStyle && RESPONSE_STYLES[effectiveStyle]){
            // ---- Locked-in style: generate a single reply as before ----
            const style = RESPONSE_STYLES[effectiveStyle];
            const styledPrompt = `${systemPrompt}\n\nResponse style: ${style.instruction}`;

            const geminiReplay=await getNexusAiApiResponse(message, imagePayload, styledPrompt, { temperature: style.temperature });
            thread.messages.push({role:"assitant",content:geminiReplay});
            thread.updatedAt=new Date();
            await thread.save();
            return res.json({reply:geminiReplay, style:effectiveStyle});
        }

        // ---- No style locked in: generate both variants side-by-side ----
        // The user message is saved now; the assistant reply is intentionally
        // left unsaved until the user picks one via /chat/choose - if they
        // never pick, no reply is persisted and the next question shows two
        // options again, which is the desired fallback behavior.
        thread.updatedAt=new Date();
        await thread.save();

        const [textA, textB] = await Promise.all([
            getNexusAiApiResponse(message, imagePayload, `${systemPrompt}\n\nResponse style: ${RESPONSE_STYLES.A.instruction}`, { temperature: RESPONSE_STYLES.A.temperature }),
            getNexusAiApiResponse(message, imagePayload, `${systemPrompt}\n\nResponse style: ${RESPONSE_STYLES.B.instruction}`, { temperature: RESPONSE_STYLES.B.temperature })
        ]);

        res.json({
            multiChoice:true,
            choices:[
                { style:"A", label:RESPONSE_STYLES.A.label, text:textA },
                { style:"B", label:RESPONSE_STYLES.B.label, text:textB }
            ]
        });
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Something Went Wrong"});
    }
 });

 //to finalize a side-by-side comparison: save the picked reply and lock the
 //thread's style so future messages in it skip straight to a single answer
 router.post("/chat/choose",async(req,res)=>{
    const {threadId,style,text}=req.body;

    if(!threadId || !style || !RESPONSE_STYLES[style] || !text || !text.trim()){
        return res.status(400).json({error:"threadId, a valid style ('A'/'B'), and text are required"});
    }

    try{
        const thread=await Thread.findOne({threadId,userId:req.user.id});
        if(!thread){
            return res.status(404).json({error:"thread not found"});
        }

        thread.messages.push({role:"assitant",content:text});
        thread.responseStyle=style;
        thread.updatedAt=new Date();
        await thread.save();

        res.json({reply:text, style});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to save your chosen response"});
    }
 });

export default router;     
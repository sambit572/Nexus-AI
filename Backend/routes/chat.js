 import express from "express";
 import multer from "multer";
 import Thread from "../models/Thread.js";
 import getNexusAiApiResponse from "../utils/nexuai.js";
 import { chatLimiter } from "../middleware/rateLimiter.js";

 const router=express.Router();

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

 //test route
 router.post("/test",async(req,res)=>{
    try{
        const thread=new Thread({
            threadId:"abc",
            title:"testing"
        });
        const responce=await thread.save();
        res.send(responce);
    } catch(err){
        console.log(err);
        res.status(500).json({error:"failed to save in DB"});
        
    }
 });

 //to get all Chat
 router.get("/thread",async(req,res)=>{
    try{
        const threads=await Thread.find({}).sort({updatedAt:-1});
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
        const thread=await Thread.findOne({threadId});
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
        const deletedThread=await Thread.findOneAndDelete({threadId});
        if(!deletedThread){
            res.status(404).json({error:"thread could not be deleted"});
        }
        res.status(200).json({success:"thread deleted successfully"});
    } catch(err){
        console.log(err);
        res.status(500).json({error:"Failed to delete Chat"});
    }
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
    const {threadId,message}=req.body;
    const imageFile=req.file;

    if(!threadId || (!message && !imageFile)){
        return res.status(400).json({error:"missing require fields"});
    }

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
        let thread=await Thread.findOne({threadId});
        const userMessage={
            role:"user",
            content: message || "(sent an image)",
            image: imageDataUrl
        };

        if(!thread){
            thread=new Thread({
               threadId,
               title: message || "Image chat",
               messages:[userMessage]
            });
        } else {
            thread.messages.push(userMessage);
        }

        const geminiReplay=await getNexusAiApiResponse(message, imagePayload);
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
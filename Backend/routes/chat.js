 import express from "express";
 import Thread from "../models/Thread.js";
 import getNexusAiApiResponse from "../utils/nexuai.js";

 const router=express.Router();

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
        const thread=await Thread.find({threadId});
        if(!thread){
            res.status(404).json({error:"thread not found"});
        }
        res.json(thread.messages);;
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
 router.post("/chat",async(req,res)=>{
    const {threadId,message}=req.body;
    if(!threadId || !message){
        res.status(400).json({error:"missing require fields"});
    }
    try{
        const thread=await Thread.findOne({threadId});
        if(!thread){
            thread=new Thread({
               threadId,
               title:message,
               messages:[{role:"user",content:message}] 
            });
        } else {
            thread.messages.push({role:"user",content:message});
        }

        const geminiReplay=await getNexusAiApiResponse(message);
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
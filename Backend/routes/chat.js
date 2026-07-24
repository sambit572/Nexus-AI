 import express from "express";
 import Thread from "../models/Thread.js";

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

export default router;
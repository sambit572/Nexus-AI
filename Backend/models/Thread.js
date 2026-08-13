import mongoose from "mongoose";

const MessageSchema=new mongoose.Schema({
    role:{
        type:String,
        enum: ["user","assitant"],
        required:true
    },
    content:{
        type:String,
        required:true
    },
    image:{
        type:String, // stores a data URL (e.g. "data:image/png;base64,...") for display in chat history
        default:null
    },
    timestamp:{
        type:Date,
        default:Date.now
    }
});

const ThreadSchema=new mongoose.Schema({
    threadId:{
        type:String,
        required:true,
        unique:true
    },
    title:{
        type:String,
        default:"New Chat"
    },
    messages:[MessageSchema],
    createdAt:{
        type:Date,
        default:Date.now
    },
    updatedAt:{
        type:Date,
        default:Date.now
    }
});

export default mongoose.model("Thread",ThreadSchema);
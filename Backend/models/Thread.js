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
        type:String, 
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
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    title:{
        type:String,
        default:"New Chat"
    },
    persona:{
        type:String,
        default:"nexus"
    },
    folder:{
        type:String,
        default:"General",
        trim:true
    },
    // null = still comparing both response styles side-by-side.
    // "A"/"B" = the user picked a style; future replies use it directly.
    responseStyle:{
        type:String,
        enum:["A","B",null],
        default:null
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
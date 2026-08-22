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
    // A per-chat custom instruction/personality on top of the selected
    // global persona - e.g. "Always answer in bullet points and use
    // nautical metaphors." Set at creation time, editable afterward.
    customInstruction:{
        type:String,
        default:"",
        trim:true,
        maxlength:1000
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
    // Rolling summary of older messages, used to keep the context sent to
    // the model bounded once a conversation gets long. summarizedCount is
    // how many leading `messages` entries are already folded into it -
    // everything from that index onward is still sent to the model raw.
    summary:{
        type:String,
        default:""
    },
    summarizedCount:{
        type:Number,
        default:0
    },
    // Public "Share" link support. shareId is only set once the user shares
    // this thread. The index is unique+sparse, and sparse indexes only
    // exclude documents where the field is entirely ABSENT - not documents
    // where it's explicitly set to null. So there's no `default: null`
    // here on purpose: leaving shareId unset until a thread is actually
    // shared means Mongoose omits the field entirely on creation, which is
    // what lets many never-shared threads coexist under one sparse unique
    // index. (Setting `default: null` here was the bug - it wrote an
    // explicit null onto every thread, which the sparse index does NOT
    // treat as absent, so the second thread ever created collided with
    // the first.)
    shareId:{
        type:String,
        unique:true,
        sparse:true
    },
    sharedAt:{
        type:Date,
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
import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import ragRoutes from "./routes/rag.js";
import { generalLimiter } from "./middleware/rateLimiter.js";


const app=express();
const PORT=8080;

app.use(express.json());
app.use(cors());

// Baseline rate limit for all API routes. Individual routes below
// (chat, auth) layer stricter limiters on top of this.
app.use("/api",generalLimiter);

app.use("/api/auth",authRoutes);
app.use("/api",chatRoutes);
app.use("/api",ragRoutes);

app.listen(PORT,()=>{
  console.log("App is listening on port 8080");
  connectDB();
});

const connectDB = async () => {
  try{
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected Successfully");
    await dropStaleIndexes();
  } catch(err){
    console.log("Failed to connect with DB",err);
  }
}

// One-time cleanup: an older version of the users collection had a unique
// index on a "username" field that no longer exists in the current User
// model. Because every new document has username=null, Mongo's unique
// index rejects every signup after the first as a duplicate key. This
// drops that stale index if it's still present - safe to leave in
// permanently, since it's a no-op once the index is gone.
const dropStaleIndexes = async () => {
  try{
    const usersCollection = mongoose.connection.collection("users");
    const indexes = await usersCollection.indexes();
    const hasStaleUsernameIndex = indexes.some(idx => idx.name === "username_1");
    if(hasStaleUsernameIndex){
      await usersCollection.dropIndex("username_1");
      console.log("Dropped stale 'username_1' index from users collection");
    }
  } catch(err){
    // Not fatal - log and continue booting either way.
    console.log("Could not check/drop stale indexes:", err.message);
  }
}
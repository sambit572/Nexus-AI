import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";


const app=express();
const PORT=8080;

app.use(express.json());
app.use(cors());

app.use("/api",chatRoutes);
app.use("/api/auth",authRoutes);

app.listen(PORT,()=>{
  console.log("App is listening on port 8080");
  connectDB();
});

const connectDB = async () => {
  try{
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("MongoDB Connected Successfully");
  } catch(err){
    console.log("Failed to connect with DB",err);
  }
}
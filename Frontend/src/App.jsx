import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";
import { useState } from 'react';
import {v1 as uuidv1} from "uuid";

function App() {
  const [prompt,setPrompt]=useState("");
  const [reply,setReply]=useState(null);
  const [currThreadId,setCurrThreadId]=useState(uuidv1());
  const [preChats,setPreChats]=useState([]);
  const [newChats,setNewChats]=useState([]);

  const providerValue={
    prompt,setPrompt,
    reply,setReply,
    currThreadId,setCurrThreadId,
    preChats,setPreChats,
    newChats,setNewChats
  };
  return (
    <div className="app">
      <MyContext.Provider value={providerValue}>
        <Sidebar></Sidebar>
        <ChatWindow></ChatWindow>
      </MyContext.Provider>
    </div>
  )
}

export default App

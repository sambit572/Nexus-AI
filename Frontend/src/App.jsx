import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";
import { useState, useEffect } from 'react';
import {v1 as uuidv1} from "uuid";

function App() {
  const [prompt,setPrompt]=useState("");
  const [reply,setReply]=useState(null);
  const [currThreadId,setCurrThreadId]=useState(uuidv1());
  const [preChats,setPreChats]=useState([]);
  const [newChats,setNewChats]=useState([]);
  const [allThreads,setAllThreads]=useState([]);
  const [theme,setTheme]=useState(()=>{
    if(typeof window !== "undefined"){
      const saved = window.localStorage.getItem("nexus-theme");
      if(saved) return saved;
      if(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    }
    return "dark";
  });

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  useEffect(()=>{
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("nexus-theme", theme);
  },[theme]);

  const providerValue={
    prompt,setPrompt,
    reply,setReply,
    currThreadId,setCurrThreadId,
    preChats,setPreChats,
    newChats,setNewChats,
    allThreads,setAllThreads,
    theme,toggleTheme
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

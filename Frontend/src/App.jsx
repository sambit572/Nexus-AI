import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import Auth from "./Auth.jsx";
import { MyContext } from "./MyContext.jsx";
import { useState, useEffect } from 'react';
import {v1 as uuidv1} from "uuid";
import {ScaleLoader} from "react-spinners";

function App() {
  const [prompt,setPrompt]=useState("");
  const [reply,setReply]=useState(null);
  const [currThreadId,setCurrThreadId]=useState(uuidv1());
  const [preChats,setPreChats]=useState([]);
  const [newChats,setNewChats]=useState([]);
  const [allThreads,setAllThreads]=useState([]);
  // null = current thread is still comparing both response styles;
  // "A"/"B" = it's locked to one style. Reset whenever the thread changes.
  const [responseStyle,setResponseStyle]=useState(null);
  const [persona,setPersona]=useState(()=>{
    if(typeof window !== "undefined"){
      return window.localStorage.getItem("nexus-persona") || "nexus";
    }
    return "nexus";
  });
  const [isSidebarOpen,setIsSidebarOpen]=useState(false);
  const [theme,setTheme]=useState(()=>{
    if(typeof window !== "undefined"){
      const saved = window.localStorage.getItem("nexus-theme");
      if(saved) return saved;
      if(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
    }
    return "dark";
  });

  // token is a 15-day JWT from the backend; user is { id, name, email }.
  // authChecked stalls rendering the app/auth screen until we've confirmed
  // whether a saved token is still valid, so a logged-in user isn't
  // flashed the login screen on every refresh.
  const [token,setToken]=useState(()=>{
    if(typeof window !== "undefined"){
      return window.localStorage.getItem("nexus-token") || null;
    }
    return null;
  });
  const [user,setUser]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  useEffect(()=>{
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("nexus-theme", theme);
  },[theme]);

  useEffect(()=>{
    window.localStorage.setItem("nexus-persona", persona);
  },[persona]);

  // On load (and whenever the token changes), verify it against the backend.
  // An expired/invalid token (e.g. past the 15-day window) clears itself out
  // here so the user falls back to the login screen automatically.
  useEffect(()=>{
    if(!token){
      setUser(null);
      setAuthChecked(true);
      return;
    }
    let cancelled=false;
    fetch("http://localhost:8080/api/auth/me",{
      headers:{ Authorization:`Bearer ${token}` }
    })
      .then(res=>{
        if(!res.ok) throw new Error("Invalid session");
        return res.json();
      })
      .then(data=>{
        if(cancelled) return;
        setUser({ id:data._id, name:data.name, email:data.email });
      })
      .catch(()=>{
        if(cancelled) return;
        window.localStorage.removeItem("nexus-token");
        setToken(null);
        setUser(null);
      })
      .finally(()=>{
        if(!cancelled) setAuthChecked(true);
      });
    return ()=>{ cancelled=true; };
  },[token]);

  const handleAuthSuccess=(newToken,newUser)=>{
    window.localStorage.setItem("nexus-token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout=()=>{
    window.localStorage.removeItem("nexus-token");
    setToken(null);
    setUser(null);
    // reset chat state so the next login starts clean
    setPrompt("");
    setReply(null);
    setPreChats([]);
    setAllThreads([]);
    setResponseStyle(null);
    setCurrThreadId(uuidv1());
  };

  const providerValue={
    prompt,setPrompt,
    reply,setReply,
    currThreadId,setCurrThreadId,
    preChats,setPreChats,
    newChats,setNewChats,
    allThreads,setAllThreads,
    responseStyle,setResponseStyle,
    theme,toggleTheme,
    persona,setPersona,
    isSidebarOpen,setIsSidebarOpen,
    token,user,logout
  };

  if(!authChecked){
    return (
      <div className="app authLoadingScreen">
        <ScaleLoader color={theme === "dark" ? "#f2f2f7" : "#191a23"} />
      </div>
    );
  }

  if(!token || !user){
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app">
      <MyContext.Provider value={providerValue}>
        {
          isSidebarOpen &&
          <div className="sidebarOverlay" onClick={()=>setIsSidebarOpen(false)}></div>
        }
        <Sidebar></Sidebar>
        <ChatWindow></ChatWindow>
      </MyContext.Provider>
    </div>
  )
}

export default App

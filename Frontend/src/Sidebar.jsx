import "./Sidebar.css";
import { useContext , useEffect, useState} from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";

function Sidebar(){
    const {allThreads,setAllThreads,currThreadId,setNewChats,setPrompt,setReply,setCurrThreadId,setPreChats} = useContext(MyContext);
    const [searchTerm, setSearchTerm] = useState("");

    const getAllThreads=async()=>{
        try {
            const response=await fetch("http://localhost:8080/api/thread");
            const res=await response.json();
            const filteredData=res.map(thread => ({threadId: thread.threadId, title: thread.title}));
            console.log(filteredData);
            setAllThreads(filteredData);
        } catch(err) {
            console.log(err);
        }
    };
    useEffect(()=>{
        getAllThreads();
    },[currThreadId]);

    const createNewChat=async()=>{
        setNewChats(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPreChats([]);
    }

    const changeThreadId=async(newThreadId)=>{
        setCurrThreadId(newThreadId);
        try{
            const response=await fetch(`http://localhost:8080/api/thread/${newThreadId}`);
            const res=await response.json();
            setPreChats(res);
            setNewChats(false);
            setReply(null);
        } catch(err){
            console.log(err);
        }
    }

    const deleteThread=async(threadId)=>{
        try{
            const response=await fetch(`http://localhost:8080/api/thread/${threadId}`,{
                method: "DELETE"
            });
            const res=await response.json();
            console.log(res);
            getAllThreads(prev=>prev.filter(thread=>thread.threadId!==threadId));
            if(currThreadId===threadId){
                createNewChat();
            }
        } catch(err){
            console.log(err);
        }
    }

    // Same keyword-matching logic used everywhere else in the app: a
    // simple case-insensitive substring match against the thread title.
    const keyword = searchTerm.trim().toLowerCase();
    const visibleThreads = keyword
        ? allThreads?.filter(thread => thread.title?.toLowerCase().includes(keyword))
        : allThreads;

    // Wraps the part of the title that matched the search keyword in a
    // <mark> so it's easy to see why a result showed up.
    const highlightMatch = (title) => {
        if(!keyword) return title;
        const idx = title?.toLowerCase().indexOf(keyword);
        if(idx === -1 || idx === undefined) return title;
        return (
            <>
                {title.slice(0, idx)}
                <mark>{title.slice(idx, idx + keyword.length)}</mark>
                {title.slice(idx + keyword.length)}
            </>
        );
    };

    return (
        <section className="sidebar">
            <button onClick={createNewChat}>
                <img className="logo"></img>
                <span><i className="fa-solid fa-pen-to-square"></i></span>
            </button>
            {/* search */}
            <div className="searchBox">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                    type="text"
                    placeholder="Search chat history"
                    value={searchTerm}
                    onChange={(e)=>setSearchTerm(e.target.value)}
                />
                {
                    searchTerm &&
                    <i className="fa-solid fa-xmark clearSearch" onClick={()=>setSearchTerm("")}></i>
                }
            </div>
            {/* history */}
            <ul className="history">
                {
                    visibleThreads?.length ? visibleThreads.map((thread,idx)=>(
                        <li key={idx} onClick={(e)=>changeThreadId(thread.threadId)} 
                        className={currThreadId===thread.threadId ? "highlighted" : ""}>
                            {highlightMatch(thread.title)}
                            <i className="fa-solid fa-trash" onClick={(e) =>{
                                e.stopPropagation();
                                deleteThread(thread.threadId);
                            }}></i>  
                        </li>
                    )) : (
                        keyword && <p className="noResults">No chats match "{searchTerm}"</p>
                    )
                }
            </ul>
            {/* sign */}
            <div className="sign">
                <p>By NEXUS TEAM</p>
            </div>
        </section>
    )
}
 export default Sidebar;
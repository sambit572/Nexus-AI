import "./Sidebar.css";
import { API_BASE_URL } from "./config.js";
import { useContext , useEffect, useState, useRef} from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";

const DEFAULT_FOLDERS = ["General","Work","Study","Personal"];

function Sidebar(){
    const {allThreads,setAllThreads,currThreadId,setNewChats,setPrompt,setReply,setCurrThreadId,setPreChats,isSidebarOpen,setIsSidebarOpen,token,setResponseStyle,setContextInfo,setPendingInstruction,setThreadInstruction} = useContext(MyContext);
    const [searchTerm, setSearchTerm] = useState("");
    const [folders, setFolders] = useState([]); // [{name,count,isDefault}]
    const [collapsed, setCollapsed] = useState({}); // { folderName: bool }
    const [moveMenuFor, setMoveMenuFor] = useState(null); // threadId with open move-menu
    const [creatingFolderFor, setCreatingFolderFor] = useState(null); // threadId currently naming a new folder
    const [newFolderName, setNewFolderName] = useState("");
    const [newChatModalOpen, setNewChatModalOpen] = useState(false);
    const [newChatInstruction, setNewChatInstruction] = useState("");
    const menuRef = useRef(null);

    const getAllThreads=async()=>{
        try {
            const response=await fetch(`${API_BASE_URL}/api/thread`,{
                headers:{ Authorization:`Bearer ${token}` }
            });
            const res=await response.json();
            const filteredData=res.map(thread => ({threadId: thread.threadId, title: thread.title, folder: thread.folder || "General"}));
            setAllThreads(filteredData);
        } catch(err) {
            console.log(err);
        }
    };

    const getFolders=async()=>{
        try {
            const response=await fetch(`${API_BASE_URL}/api/folders`,{
                headers:{ Authorization:`Bearer ${token}` }
            });
            const res=await response.json();
            setFolders(res);
        } catch(err) {
            console.log(err);
        }
    };

    useEffect(()=>{
        if(token){
            getAllThreads();
            getFolders();
        }
    },[currThreadId]);

    // Close any open "move to folder" menu when clicking elsewhere.
    useEffect(()=>{
        const handleClickOutside=(e)=>{
            if(menuRef.current && !menuRef.current.contains(e.target)){
                setMoveMenuFor(null);
                setCreatingFolderFor(null);
                setNewFolderName("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return ()=>document.removeEventListener("mousedown", handleClickOutside);
    },[]);

    // Opens a small modal so the user can optionally set a personality/
    // instruction for the new chat before it starts (or just skip it).
    const openNewChatModal=()=>{
        setNewChatInstruction("");
        setNewChatModalOpen(true);
        setIsSidebarOpen(false); // auto-close sidebar on mobile
    }

    const startNewChat=(instructionText)=>{
        setNewChats(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPreChats([]);
        setResponseStyle(null);
        setContextInfo(null);
        setThreadInstruction("");
        // Held until the first message of this new thread goes out, then cleared.
        setPendingInstruction((instructionText || "").trim());
        setNewChatModalOpen(false);
    }

    const changeThreadId=async(newThreadId)=>{
        setCurrThreadId(newThreadId);
        setIsSidebarOpen(false); // auto-close on mobile after picking a thread
        try{
            const response=await fetch(`${API_BASE_URL}/api/thread/${newThreadId}`,{
                headers:{ Authorization:`Bearer ${token}` }
            });
            const res=await response.json();
            setPreChats(res.messages || []);
            setResponseStyle(res.responseStyle || null);
            setThreadInstruction(res.customInstruction || "");
            setContextInfo(res.contextSummary ? {
                summary: res.contextSummary,
                summarizedCount: res.summarizedCount || 0,
                totalMessages: res.totalMessages || 0
            } : null);
            setNewChats(false);
            setReply(null);
        } catch(err){
            console.log(err);
        }
    }

    const deleteThread=async(threadId)=>{
        try{
            const response=await fetch(`${API_BASE_URL}/api/thread/${threadId}`,{
                method: "DELETE",
                headers:{ Authorization:`Bearer ${token}` }
            });
            const res=await response.json();
            console.log(res);
            setAllThreads(prev=>prev.filter(thread=>thread.threadId!==threadId));
            if(currThreadId===threadId){
                startNewChat("");
            }
        } catch(err){
            console.log(err);
        }
    }

    const moveThreadToFolder=async(threadId, folderName)=>{
        const name = folderName.trim();
        if(!name) return;
        try{
            const response=await fetch(`${API_BASE_URL}/api/thread/${threadId}/folder`,{
                method:"PATCH",
                headers:{
                    Authorization:`Bearer ${token}`,
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({ folder: name })
            });
            const res=await response.json();
            if(response.ok){
                setAllThreads(prev=>prev.map(t=>t.threadId===threadId ? {...t, folder:name} : t));
                getFolders();
            } else {
                console.log(res.error);
            }
        } catch(err){
            console.log(err);
        } finally {
            setMoveMenuFor(null);
            setCreatingFolderFor(null);
            setNewFolderName("");
        }
    }

    const toggleCollapsed=(folderName)=>{
        setCollapsed(prev=>({...prev, [folderName]: !prev[folderName]}));
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

    // Group the (possibly search-filtered) threads by folder. Folders with
    // zero matching threads while searching are simply omitted.
    const grouped = {};
    (visibleThreads || []).forEach(thread=>{
        const folderName = thread.folder || "General";
        if(!grouped[folderName]) grouped[folderName] = [];
        grouped[folderName].push(thread);
    });

    // Order: default folders first (fixed order), then any custom folders
    // alphabetically - matching what /api/folders returns.
    const orderedFolderNames = folders.length
        ? folders.map(f=>f.name).filter(name => grouped[name]?.length)
        : Object.keys(grouped);

    // Options offered in the "move to folder" menu: known folders minus
    // the thread's current one, plus a "New folder" action.
    const folderOptionNames = folders.length ? folders.map(f=>f.name) : DEFAULT_FOLDERS;

    return (
        <section className={"sidebar" + (isSidebarOpen ? " sidebarOpen" : "")}>
            <button onClick={openNewChatModal}>
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
            {/* history grouped by folder */}
            <div className="history">
                {
                    orderedFolderNames.length ? orderedFolderNames.map(folderName=>(
                        <div className="folderGroup" key={folderName}>
                            <div className="folderHeader" onClick={()=>toggleCollapsed(folderName)}>
                                <i className={"fa-solid " + (collapsed[folderName] ? "fa-chevron-right" : "fa-chevron-down")}></i>
                                <i className="fa-solid fa-folder folderIcon"></i>
                                <span className="folderName">{folderName}</span>
                                <span className="folderCount">{grouped[folderName].length}</span>
                            </div>
                            {
                                !collapsed[folderName] &&
                                <ul className="folderThreads">
                                    {
                                        grouped[folderName].map((thread,idx)=>(
                                            <li key={idx} onClick={()=>changeThreadId(thread.threadId)}
                                            className={currThreadId===thread.threadId ? "highlighted" : ""}>
                                                <span className="threadTitle">{highlightMatch(thread.title)}</span>
                                                <span className="threadActions">
                                                    <i
                                                        className="fa-solid fa-folder-tree"
                                                        title="Move to folder"
                                                        onClick={(e)=>{
                                                            e.stopPropagation();
                                                            setMoveMenuFor(moveMenuFor===thread.threadId ? null : thread.threadId);
                                                            setCreatingFolderFor(null);
                                                        }}
                                                    ></i>
                                                    <i className="fa-solid fa-trash" onClick={(e) =>{
                                                        e.stopPropagation();
                                                        deleteThread(thread.threadId);
                                                    }}></i>
                                                </span>

                                                {
                                                    moveMenuFor===thread.threadId &&
                                                    <div className="moveMenu" ref={menuRef} onClick={(e)=>e.stopPropagation()}>
                                                        {
                                                            creatingFolderFor===thread.threadId ? (
                                                                <div className="newFolderRow">
                                                                    <input
                                                                        autoFocus
                                                                        placeholder="Folder name"
                                                                        value={newFolderName}
                                                                        onChange={(e)=>setNewFolderName(e.target.value)}
                                                                        onKeyDown={(e)=>{
                                                                            if(e.key==="Enter") moveThreadToFolder(thread.threadId, newFolderName);
                                                                            if(e.key==="Escape"){ setCreatingFolderFor(null); setNewFolderName(""); }
                                                                        }}
                                                                    />
                                                                    <i className="fa-solid fa-check" onClick={()=>moveThreadToFolder(thread.threadId, newFolderName)}></i>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    {
                                                                        folderOptionNames
                                                                            .filter(name=>name!==thread.folder)
                                                                            .map(name=>(
                                                                                <div
                                                                                    className="moveMenuItem"
                                                                                    key={name}
                                                                                    onClick={()=>moveThreadToFolder(thread.threadId, name)}
                                                                                >
                                                                                    <i className="fa-solid fa-folder"></i> {name}
                                                                                </div>
                                                                            ))
                                                                    }
                                                                    <div
                                                                        className="moveMenuItem moveMenuNewItem"
                                                                        onClick={()=>setCreatingFolderFor(thread.threadId)}
                                                                    >
                                                                        <i className="fa-solid fa-plus"></i> New folder
                                                                    </div>
                                                                </>
                                                            )
                                                        }
                                                    </div>
                                                }
                                            </li>
                                        ))
                                    }
                                </ul>
                            }
                        </div>
                    )) : (
                        keyword && <p className="noResults">No chats match "{searchTerm}"</p>
                    )
                }
            </div>
            {/* sign */}
            <div className="sign">
                <p>By NEXUS TEAM</p>
            </div>

            {
                newChatModalOpen &&
                <div className="newChatOverlay" onClick={()=>setNewChatModalOpen(false)}>
                    <div className="newChatModal" onClick={(e)=>e.stopPropagation()}>
                        <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Give this chat a personality</h3>
                        <p className="newChatModalHint">
                            Optional. Add instructions just for this chat - tone, format, role, anything -
                            on top of your selected persona. You can edit or clear this anytime.
                        </p>
                        <textarea
                            autoFocus
                            placeholder={`e.g. "Act as a strict code reviewer, be blunt and point out every issue" or "Explain things simply, like for a 12 year old"`}
                            value={newChatInstruction}
                            onChange={(e)=>setNewChatInstruction(e.target.value)}
                            maxLength={1000}
                        />
                        <div className="newChatModalCount">{newChatInstruction.length}/1000</div>
                        <div className="newChatModalActions">
                            <button className="newChatSkipBtn" onClick={()=>startNewChat("")}>
                                Skip
                            </button>
                            <button className="newChatStartBtn" onClick={()=>startNewChat(newChatInstruction)}>
                                <i className="fa-solid fa-arrow-right"></i> Start chat
                            </button>
                        </div>
                    </div>
                </div>
            }
        </section>
    )
}
 export default Sidebar;

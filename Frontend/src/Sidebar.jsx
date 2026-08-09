import "./Sidebar.css";
import { useContext , useEffect} from "react";
import { MyContext } from "./MyContext.jsx";
import {v1 as uuidv1} from "uuid";

function Sidebar(){
    const {allThreads,setAllThreads,currThreadId,setNewChats,setPrompt,setReply,setCurrThreadId,setPreChats} = useContext(MyContext);
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
    return (
        <section className="sidebar">
            <button onClick={createNewChat}>
                <img className="logo"></img>
                <span><i className="fa-solid fa-pen-to-square"></i></span>
            </button>
            {/* history */}
            <ul className="history">
                {
                    allThreads?.map((thread,idx)=>(
                        <li key={idx} onClick={(e)=>changeThreadId(thread.threadId)}>
                            {thread.title}   
                        </li>
                    ))
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
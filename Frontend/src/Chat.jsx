import "./Chat.css";
import { useContext,useState,useEffect } from "react";
import { MyContext } from "./MyContext.jsx";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat({getReply}){
    const {preChats,setPreChats,newChats,reply} = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);
    const [editingIdx, setEditingIdx] = useState(null);
    const [editValue, setEditValue] = useState("");

    const startEdit = (idx, content) => {
        setEditingIdx(idx);
        setEditValue(content);
    };

    const cancelEdit = () => {
        setEditingIdx(null);
        setEditValue("");
    };

    // Drops the edited message and everything after it, then re-sends
    // the edited text so a fresh AI reply is generated for it.
    const saveEditAndRegenerate = (idx) => {
        if(!editValue.trim()) return;
        setPreChats(prev => prev.slice(0, idx));
        setEditingIdx(null);
        getReply(editValue.trim());
    };

    // Regenerate the AI response for the last exchange without editing
    // the user's prompt.
    const regenerateLast = () => {
        if(!preChats?.length) return;
        const lastUserMsg = [...preChats].reverse().find(c => c.role === "user");
        if(!lastUserMsg) return;
        const lastUserIdx = preChats.lastIndexOf(lastUserMsg);
        setPreChats(prev => prev.slice(0, lastUserIdx));
        getReply(lastUserMsg.content);
    };

    useEffect(() => {
        if (reply === null) {
            setLatestReply(null);
            return;
        }

        if(!preChats?.length) return;
        const content=reply.split(" ");
        let idx=0;
        const interval=setInterval(()=>{
            setLatestReply(content.slice(0, idx+1).join(" "));
            idx++;
            if(idx>=content.length) clearInterval(interval);
        }, 40);
        return () => clearInterval(interval);
    }, [preChats,reply]);
    return (
        <>
            {newChats && <h1>Begin a New Journey</h1>}
            <div className="chats">
                {
                    preChats?.slice(0, -1).map((chat,idx)=>
                        <div className={chat.role==="user"?"userDiv":"nexusDiv"} key={idx}>
                            {
                                chat.role === "user" ? (
                                    editingIdx === idx ? (
                                        <div className="editBox">
                                            <textarea
                                                className="editTextarea"
                                                value={editValue}
                                                onChange={(e)=>setEditValue(e.target.value)}
                                                onKeyDown={(e)=>{
                                                    if(e.key==="Enter" && !e.shiftKey){
                                                        e.preventDefault();
                                                        saveEditAndRegenerate(idx);
                                                    }
                                                    if(e.key==="Escape") cancelEdit();
                                                }}
                                                autoFocus
                                            />
                                            <div className="editActions">
                                                <button className="editSaveBtn" onClick={()=>saveEditAndRegenerate(idx)}>
                                                    <i className="fa-solid fa-arrow-rotate-right"></i> Save & Regenerate
                                                </button>
                                                <button className="editCancelBtn" onClick={cancelEdit}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="userMessageWrap">
                                            <span className="editIcon" onClick={()=>startEdit(idx, chat.content)} title="Edit & regenerate">
                                                <i className="fa-solid fa-pen"></i>
                                            </span>
                                            <div className="userMessage">
                                                {
                                                    chat.image &&
                                                    <img src={chat.image} alt="User attachment" className="chatImageAttachment" />
                                                }
                                                {
                                                    chat.content &&
                                                    <p className="userMessageText">{chat.content}</p>
                                                }
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                )
                            }
                        </div>
                    )
                }

                {
                    preChats?.length >0 && (
                        <>
                            {
                                latestReply === null ? (
                                    <div className="nexusDiv" key={"typing"}>
                                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{preChats[preChats.length - 1].content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="nexusDiv" key={"typing"}>
                                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{latestReply}</ReactMarkdown>
                                        {
                                            latestReply === reply &&
                                            <span className="regenIcon" onClick={regenerateLast} title="Regenerate response">
                                                <i className="fa-solid fa-arrow-rotate-right"></i> Regenerate
                                            </span>
                                        }
                                    </div>
                                )
                            }
                        </>
                    )
                }
                
            </div>
        </>
    )
}

export default Chat;
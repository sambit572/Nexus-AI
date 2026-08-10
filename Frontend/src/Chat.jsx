import "./Chat.css";
import { useContext,useState,useEffect } from "react";
import { MyContext } from "./MyContext.jsx";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat(){
    const {preChats,newChats,reply} = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);

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
                                chat.role === "user" ? 
                                <p className="userMessage">{chat.content}</p> : 
                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
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
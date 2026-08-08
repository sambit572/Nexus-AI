import "./Chat.css";
import { useContext } from "react";
import { MyContext } from "./MyContext.jsx";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function Chat(){
    const {preChats,newChats} = useContext(MyContext);
    return (
        <>
            {newChats && <h1>Begin a New Journey</h1>}
            <div className="chats">
                {
                    preChats?.map((chat,idx)=>
                        <div className={chat.role==="user"?"userDiv":"nexusDiv"} key={idx}>
                            {
                                chat.role === "user" ? 
                                <p className="userMessage">{chat.content}</p> : 
                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                            }
                        </div>
                    )
                }
                
            </div>
        </>
    )
}

export default Chat;
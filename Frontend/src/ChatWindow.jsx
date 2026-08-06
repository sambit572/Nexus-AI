import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext } from "react";

function ChatWindow(){

    const {prompt,setPrompt,reply,setReply,currThreadId}=useContext(MyContext);
    const getReply=async()=>{
        const options={
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:{
                message:prompt,
                threadId:currThreadId
            }
        };
        try {
            await fetch("http://localhost:8080/api/chat");
        } catch(err) {
            console.log(err);
        }
    }

    return(
        <div className="chatWindow">
            <div className="navbar">
                <span>Nexus AI <i class="fa-solid fa-chevron-down"></i></span>
                <div className="userIconDiv">
                    <span className="userIcon"><i class="fa-solid fa-user"></i></span>
                </div>
            </div>
            <Chat></Chat>
            <div className="chatInput">
                <div className="inputBox">
                    <input placeholder="Ask your Query"
                    value={prompt}
                    onChange={(e)=>setPrompt(e.target.value)}
                    >
                        
                    </input>
                    <div id="submit" onClick={getReply}><i class="fa-solid fa-paper-plane"></i></div>
                </div>
                <p className="info">
                    Build by NEXUS TEAM
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;
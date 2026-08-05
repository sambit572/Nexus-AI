import "./ChatWindow.css";
import Chat from "./Chat.jsx";

function ChatWindow(){
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
                    <input placeholder="Ask your Query">

                    </input>
                    <div id="submit"><i class="fa-solid fa-paper-plane"></i></div>
                </div>
                <p className="info">
                    Build by NEXUS TEAM
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;
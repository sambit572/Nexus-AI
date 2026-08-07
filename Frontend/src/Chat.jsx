import "./Chat.css";
import { useContext } from "react";
import { MyContext } from "./MyContext.jsx";

function Chat(){
    const {preChats,newChats} = useContext(MyContext);
    return (
        <>
            {newChats && <h1>Begin a New Journey</h1>}
            <div className="chats">
                <div className="userDiv"></div>
                <div className="nexusDiv"></div>
            </div>
        </>
    )
}

export default Chat;
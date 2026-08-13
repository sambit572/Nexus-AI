import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext,useState,useEffect,useRef} from "react";
import {ScaleLoader} from "react-spinners";

const MAX_IMAGE_MB = 4;

function ChatWindow(){

    const {prompt,setPrompt,reply,setReply,currThreadId,preChats,setPreChats,newChats,setNewChats,theme,toggleTheme}=useContext(MyContext);
    const [loading,setLoading]=useState(false);
    const [isOpen,setIsOpen]=useState(false);
    const [image,setImage]=useState(null);           // File object staged for the next send
    const [imagePreview,setImagePreview]=useState(null); // data URL, shown in the composer
    const [sentImagePreview,setSentImagePreview]=useState(null); // carried into preChats once the reply lands
    const [imageError,setImageError]=useState("");
    const fileInputRef=useRef(null);

    const handleImageSelect=(e)=>{
        const file=e.target.files[0];
        if(!file) return;

        if(!file.type.startsWith("image/")){
            setImageError("Please select an image file.");
            e.target.value="";
            return;
        }
        if(file.size > MAX_IMAGE_MB * 1024 * 1024){
            setImageError(`Image is too large. Please choose one under ${MAX_IMAGE_MB}MB.`);
            e.target.value="";
            return;
        }

        setImageError("");
        setImage(file);
        const reader=new FileReader();
        reader.onload=()=>setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const removeImage=()=>{
        setImage(null);
        setImagePreview(null);
        setImageError("");
        if(fileInputRef.current) fileInputRef.current.value="";
    };

    // overrideMessage: pass an edited prompt to regenerate a response for it
    // instead of whatever is currently typed in the input box. Edits/regenerates
    // are text-only, so no image is attached in that path.
    const getReply=async(overrideMessage)=>{
        const isOverride = overrideMessage!==undefined;
        const messageToSend = isOverride ? overrideMessage : prompt;
        const imageToSend = isOverride ? null : image;

        if((!messageToSend || !messageToSend.trim()) && !imageToSend) return;

        setLoading(true);
        setNewChats(false);

        const formData=new FormData();
        formData.append("message", messageToSend || "");
        formData.append("threadId", currThreadId);
        if(imageToSend) formData.append("image", imageToSend);

        try {
            const response=await fetch("http://localhost:8080/api/chat",{
                method:"POST",
                body:formData
            });
            const data=await response.json();
            console.log(data);
            if(!response.ok){
                console.log(data.error || "Something went wrong");
            } else {
                // Keep prompt/image in sync with what was actually sent so the
                // reply-effect below appends the correct user/assistant pair.
                setPrompt(messageToSend);
                setSentImagePreview(imageToSend ? imagePreview : null);
                setReply(data.reply);
            }
        } catch(err) {
            console.log(err);
        }
        setLoading(false);
        if(!isOverride){
            removeImage();
        }
    }

    useEffect(()=>{
        if(reply && (prompt || sentImagePreview)){
            setPreChats(preChats => (
                [...preChats,{
                    role:"user",
                    content:prompt,
                    image:sentImagePreview
                },{
                    role:"assistant",
                    content:reply
                }]
            ));
        }
        setPrompt("");
        setSentImagePreview(null);
    },[reply]);

    return(
        <div className="chatWindow">
            <div className="navbar">
                <span>Nexus AI <i className="fa-solid fa-chevron-down"></i></span>
                <div className="navRight">
                    <button
                        className="themeToggle"
                        onClick={toggleTheme}
                        aria-label="Toggle light and dark mode"
                        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        <i className={theme === "dark" ? "fa-solid fa-moon" : "fa-solid fa-sun"}></i>
                    </button>
                    <div className="userIconDiv" onClick={()=>{
                        setIsOpen(!isOpen);
                    }}>
                        <span className="userIcon"><i className="fa-solid fa-user"></i></span>
                    </div>
                </div>
            </div>
            {
                isOpen &&
                <div className="dropDown">
                    <div className="dropDownItem"><i className="fa-solid fa-cloud-arrow-up"></i>Upgrade</div>
                    <div className="dropDownItem"><i className="fa-solid fa-gear"></i>Settings</div>
                    <div className="dropDownItem"><i className="fa-solid fa-sign-out"></i>Logout</div>
                </div>
            }
            <Chat getReply={getReply}></Chat>

            <ScaleLoader color={theme === "dark" ? "#f2f2f7" : "#191a23"} loading={loading}>

            </ScaleLoader>
            <div className="chatInput">
                {
                    imagePreview &&
                    <div className="imagePreviewBar">
                        <div className="imagePreviewChip">
                            <img src={imagePreview} alt="Selected attachment preview" />
                            <button
                                type="button"
                                className="removeImageBtn"
                                onClick={removeImage}
                                title="Remove image"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                }
                {
                    imageError &&
                    <p className="imageError">{imageError}</p>
                }
                <div className="inputBox">
                    <button
                        type="button"
                        className="attachBtn"
                        onClick={()=>fileInputRef.current?.click()}
                        title="Attach an image"
                    >
                        <i className="fa-solid fa-plus"></i>
                    </button>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        style={{display:"none"}}
                    />
                    <input placeholder="Ask your Query"
                    value={prompt}
                    onChange={(e)=>setPrompt(e.target.value)}
                    onKeyDown={(e)=>e.key==="Enter"?getReply():""}
                        
                    >
                        
                    </input>
                    <div id="submit" onClick={()=>getReply()}><i className="fa-solid fa-paper-plane"></i></div>
                </div>
                <p className="info">
                    Build by NEXUS TEAM
                </p>
            </div>
        </div>
    )
}

export default ChatWindow;
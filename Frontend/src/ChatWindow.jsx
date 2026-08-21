import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import RagPanel from "./RagPanel.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext,useState,useEffect,useRef} from "react";
import {ScaleLoader} from "react-spinners";
import { exportChatAsMarkdown, exportChatAsPDF } from "./exportChat.js";

const MAX_IMAGE_MB = 4;

function ChatWindow(){

    const {prompt,setPrompt,reply,setReply,currThreadId,preChats,setPreChats,newChats,setNewChats,theme,toggleTheme,persona,setPersona,isSidebarOpen,setIsSidebarOpen,token,user,logout,responseStyle,setResponseStyle}=useContext(MyContext);
    const [loading,setLoading]=useState(false);
    const [isOpen,setIsOpen]=useState(false);
    const [exportOpen,setExportOpen]=useState(false);
    const [personaOpen,setPersonaOpen]=useState(false);
    const [ragOpen,setRagOpen]=useState(false);
    const [personas,setPersonas]=useState([]);
    const [responseStyles,setResponseStyles]=useState([]); // [{id,label,description}]
    const [pendingChoices,setPendingChoices]=useState(null); // [{style,label,text}] awaiting a pick, or null
    const [choosing,setChoosing]=useState(false);
    const [image,setImage]=useState(null);           // File object staged for the next send
    const [imagePreview,setImagePreview]=useState(null); // data URL, shown in the composer
    const [sentImagePreview,setSentImagePreview]=useState(null); // carried into preChats once the reply lands
    const [imageError,setImageError]=useState("");
    const fileInputRef=useRef(null);
    const [isListening,setIsListening]=useState(false);
    const recognitionRef=useRef(null);
    const baseTextRef=useRef("");     // text already in the box when recording started
    const finalChunksRef=useRef({});  // { resultIndex: finalized transcript } — avoids double-appending when Chrome re-fires the same index

    useEffect(()=>{
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(!SpeechRecognition) return; // browser doesn't support Web Speech API

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event)=>{
            let interimTranscript = "";

            for(let i=event.resultIndex; i<event.results.length; i++){
                const transcript = event.results[i][0].transcript;
                if(event.results[i].isFinal){
                    // store/overwrite by index instead of appending, so a
                    // repeated event for the same index doesn't duplicate text
                    finalChunksRef.current[i] = transcript.trim();
                } else {
                    interimTranscript += transcript;
                }
            }

            const finalText = Object.keys(finalChunksRef.current)
                .sort((a,b)=>a-b)
                .map(k=>finalChunksRef.current[k])
                .join(" ");

            const combined = [baseTextRef.current, finalText, interimTranscript]
                .filter(Boolean)
                .join(" ");

            setPrompt(combined);
        };

        recognition.onerror = ()=>{
            setIsListening(false);
        };

        recognition.onend = ()=>{
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return ()=>{
            recognition.stop();
        };
    },[]);

    const toggleVoiceInput=()=>{
        const recognition = recognitionRef.current;
        if(!recognition){
            alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
            return;
        }
        if(isListening){
            recognition.stop();
            setIsListening(false);
        } else {
            baseTextRef.current = prompt;
            finalChunksRef.current = {};
            recognition.start();
            setIsListening(true);
        }
    };

    useEffect(()=>{
        fetch("http://localhost:8080/api/personas",{
            headers:{ Authorization:`Bearer ${token}` }
        })
            .then(res=>res.json())
            .then(data=>setPersonas(data.personas || []))
            .catch(err=>console.log("Failed to load personas:",err));

        fetch("http://localhost:8080/api/response-styles",{
            headers:{ Authorization:`Bearer ${token}` }
        })
            .then(res=>res.json())
            .then(data=>setResponseStyles(data.styles || []))
            .catch(err=>console.log("Failed to load response styles:",err));
    },[]);

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
        // A fresh question always discards any unanswered comparison from
        // the previous turn - that one is simply left without a reply.
        setPendingChoices(null);

        const formData=new FormData();
        formData.append("message", messageToSend || "");
        formData.append("threadId", currThreadId);
        formData.append("persona", persona || "nexus");
        if(imageToSend) formData.append("image", imageToSend);

        try {
            const response=await fetch("http://localhost:8080/api/chat",{
                method:"POST",
                headers:{ Authorization:`Bearer ${token}` },
                body:formData
            });
            const data=await response.json();
            console.log(data);
            if(!response.ok){
                console.log(data.error || "Something went wrong");
            } else if(data.multiChoice){
                // No style locked in yet: show both candidate answers and
                // wait for the user to pick one. The user's message is
                // appended immediately; no assistant reply exists yet.
                setPreChats(prev => [...prev, {
                    role:"user",
                    content: messageToSend,
                    image: imageToSend ? imagePreview : null
                }]);
                setPendingChoices(data.choices);
                setPrompt("");
                setSentImagePreview(null);
            } else {
                // Keep prompt/image in sync with what was actually sent so the
                // reply-effect below appends the correct user/assistant pair.
                setPrompt(messageToSend);
                setSentImagePreview(imageToSend ? imagePreview : null);
                setReply(data.reply);
                if(data.style) setResponseStyle(data.style);
            }
        } catch(err) {
            console.log(err);
        }
        setLoading(false);
        if(!isOverride){
            removeImage();
        }
    }

    // Called when the user picks one of the two side-by-side answers.
    // Saves it as the real assistant reply and locks the thread to that style.
    const choosePendingResponse=async(style,text)=>{
        if(choosing) return;
        setChoosing(true);
        try{
            const response=await fetch("http://localhost:8080/api/chat/choose",{
                method:"POST",
                headers:{
                    Authorization:`Bearer ${token}`,
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({ threadId: currThreadId, style, text })
            });
            const data=await response.json();
            if(!response.ok){
                console.log(data.error || "Failed to save your chosen response");
            } else {
                setPreChats(prev => [...prev, { role:"assistant", content:data.reply }]);
                setResponseStyle(data.style);
                setPendingChoices(null);
            }
        } catch(err){
            console.log(err);
        }
        setChoosing(false);
    }

    // Lets the user go back to side-by-side comparison mode for this thread.
    const resetResponseStyle=async()=>{
        try{
            const response=await fetch(`http://localhost:8080/api/thread/${currThreadId}/style`,{
                method:"PATCH",
                headers:{
                    Authorization:`Bearer ${token}`,
                    "Content-Type":"application/json"
                },
                body: JSON.stringify({ style:null })
            });
            if(response.ok){
                setResponseStyle(null);
            }
        } catch(err){
            console.log(err);
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
                <button
                    className="hamburgerBtn"
                    onClick={()=>setIsSidebarOpen(!isSidebarOpen)}
                    aria-label="Toggle sidebar"
                    title="Toggle sidebar"
                >
                    <i className="fa-solid fa-bars"></i>
                </button>
                <span>Nexus AI <i className="fa-solid fa-chevron-down"></i></span>
                <div className="navRight">
                    <div className="exportDiv">
                        <button
                            className="themeToggle personaToggle"
                            onClick={()=>{
                                setPersonaOpen(!personaOpen);
                                setIsOpen(false);
                                setExportOpen(false);
                            }}
                            aria-label="Choose AI persona"
                            title="Choose AI persona"
                        >
                            <i className={(personas.find(p=>p.id===persona)?.icon) || "fa-solid fa-sparkles"}></i>
                            <span className="personaLabel">
                                {(personas.find(p=>p.id===persona)?.name) || "Nexus"}
                            </span>
                        </button>
                        {
                            personaOpen &&
                            <div className="dropDown exportDropDown personaDropDown">
                                {
                                    personas.map(p=>(
                                        <div
                                            key={p.id}
                                            className={"dropDownItem" + (p.id===persona ? " activePersona" : "")}
                                            onClick={()=>{ setPersona(p.id); setPersonaOpen(false); }}
                                        >
                                            <i className={p.icon}></i>
                                            <div className="personaItemText">
                                                <span className="personaItemName">{p.name}</span>
                                                <span className="personaItemDesc">{p.description}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        }
                    </div>
                    {
                        responseStyle &&
                        <div className="styleChip" title="Currently answering in this style for this chat">
                            <i className="fa-solid fa-code-compare"></i>
                            <span className="styleChipLabel">
                                {responseStyles.find(s=>s.id===responseStyle)?.label || responseStyle}
                            </span>
                            <i
                                className="fa-solid fa-xmark styleChipReset"
                                title="Compare styles again"
                                onClick={resetResponseStyle}
                            ></i>
                        </div>
                    }
                    <div className="exportDiv">
                        <button
                            className="themeToggle"
                            onClick={()=>{
                                setExportOpen(!exportOpen);
                                setIsOpen(false);
                                setPersonaOpen(false);
                            }}
                            aria-label="Export conversation"
                            title="Export conversation"
                        >
                            <i className="fa-solid fa-download"></i>
                        </button>
                        {
                            exportOpen &&
                            <div className="dropDown exportDropDown">
                                <div
                                    className="dropDownItem"
                                    onClick={()=>{ exportChatAsPDF(preChats); setExportOpen(false); }}
                                >
                                    <i className="fa-solid fa-file-pdf"></i>Download as PDF
                                </div>
                                <div
                                    className="dropDownItem"
                                    onClick={()=>{ exportChatAsMarkdown(preChats); setExportOpen(false); }}
                                >
                                    <i className="fa-solid fa-file-lines"></i>Download as Markdown
                                </div>
                            </div>
                        }
                    </div>
                    <button
                        className="themeToggle"
                        onClick={()=>{
                            setRagOpen(true);
                            setIsOpen(false);
                            setExportOpen(false);
                            setPersonaOpen(false);
                        }}
                        aria-label="Chat with your documents"
                        title="Chat with your documents (RAG)"
                    >
                        <i className="fa-solid fa-file-lines"></i>
                    </button>
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
                        setExportOpen(false);
                        setPersonaOpen(false);
                    }}>
                        <span className="userIcon" title={user?.name || "Account"}>
                            {
                                user?.name
                                    ? user.name.trim().charAt(0).toUpperCase()
                                    : <i className="fa-solid fa-user"></i>
                            }
                        </span>
                    </div>
                </div>
            </div>
            {
                isOpen &&
                <div className="dropDown userDropDown">
                    {
                        user &&
                        <div className="userDropDownHeader">
                            <span className="userDropDownName">{user.name}</span>
                            <span className="userDropDownEmail">{user.email}</span>
                        </div>
                    }
                    <div className="dropDownItem"><i className="fa-solid fa-cloud-arrow-up"></i>Upgrade</div>
                    <div className="dropDownItem"><i className="fa-solid fa-gear"></i>Settings</div>
                    <div className="dropDownItem" onClick={()=>{ setIsOpen(false); logout(); }}>
                        <i className="fa-solid fa-sign-out"></i>Logout
                    </div>
                </div>
            }
            <Chat
                getReply={getReply}
                pendingChoices={pendingChoices}
                onChoosePending={choosePendingResponse}
                choosing={choosing}
            ></Chat>

            { ragOpen && <RagPanel onClose={()=>setRagOpen(false)} /> }

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
                    <button
                        type="button"
                        id="micBtn"
                        className={isListening ? "listening" : ""}
                        onClick={toggleVoiceInput}
                        title={isListening ? "Stop voice input" : "Start voice input"}
                        aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    >
                        <i className={isListening ? "fa-solid fa-stop" : "fa-solid fa-microphone"}></i>
                    </button>
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
import "./SharedThread.css";
import { API_BASE_URL } from "./config.js";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function SharedThread({ shareId }){
    const [thread,setThread]=useState(null);
    const [error,setError]=useState("");
    const [loading,setLoading]=useState(true);

    useEffect(()=>{
        let cancelled=false;
        fetch(`${API_BASE_URL}/api/shared/${shareId}`)
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ok, data})=>{
                if(cancelled) return;
                if(!ok){
                    setError(data.error || "This share link is invalid or has been revoked.");
                } else {
                    setThread(data);
                }
            })
            .catch(()=>{
                if(!cancelled) setError("Couldn't load this conversation. Please check your connection and try again.");
            })
            .finally(()=>{
                if(!cancelled) setLoading(false);
            });
        return ()=>{ cancelled=true; };
    },[shareId]);

    if(loading){
        return (
            <div className="sharedPage">
                <div className="sharedLoading">
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Loading conversation...</span>
                </div>
            </div>
        );
    }

    if(error){
        return (
            <div className="sharedPage">
                <div className="sharedError">
                    <i className="fa-solid fa-link-slash"></i>
                    <h2>Link unavailable</h2>
                    <p>{error}</p>
                    <a className="sharedHomeBtn" href="/">Go to Nexus AI</a>
                </div>
            </div>
        );
    }

    return (
        <div className="sharedPage">
            <header className="sharedHeader">
                <div className="sharedHeaderInner">
                    <div className="sharedBrand">
                        <i className="fa-solid fa-sparkles"></i>
                        <span>Nexus AI</span>
                    </div>
                    <a className="sharedTryBtn" href="/">Try Nexus AI</a>
                </div>
            </header>

            <main className="sharedMain">
                <div className="sharedTitleBlock">
                    <h1>{thread.title || "Shared conversation"}</h1>
                    <p className="sharedMeta">
                        <i className="fa-solid fa-eye"></i> Read-only shared conversation
                        {
                            thread.sharedAt &&
                            <> &middot; shared {new Date(thread.sharedAt).toLocaleDateString(undefined,{ year:"numeric", month:"short", day:"numeric" })}</>
                        }
                    </p>
                </div>

                <div className="sharedChats">
                    {
                        thread.messages?.map((chat,idx)=>(
                            <div className={chat.role==="user" ? "sharedUserDiv" : "sharedNexusDiv"} key={idx}>
                                {
                                    chat.role === "user" ? (
                                        <div className="sharedUserMessage">
                                            {
                                                chat.image &&
                                                <img src={chat.image} alt="Attachment" className="sharedChatImage" />
                                            }
                                            {
                                                chat.content &&
                                                <p>{chat.content}</p>
                                            }
                                        </div>
                                    ) : (
                                        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                    )
                                }
                            </div>
                        ))
                    }
                    {
                        (!thread.messages || thread.messages.length === 0) &&
                        <p className="sharedEmpty">This conversation is empty.</p>
                    }
                </div>
            </main>

            <footer className="sharedFooter">
                <p>Shared from Nexus AI &middot; <a href="/">Start your own conversation</a></p>
            </footer>
        </div>
    );
}

export default SharedThread;

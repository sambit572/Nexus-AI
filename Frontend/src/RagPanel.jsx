import "./RagPanel.css";
import { API_BASE_URL } from "./config.js";
import { useContext, useEffect, useRef, useState } from "react";
import { MyContext } from "./MyContext.jsx";

const API_BASE = `${API_BASE_URL}/api`;

function formatBytes(chars) {
    if (!chars) return "0 chars";
    if (chars < 1000) return `${chars} chars`;
    return `${(chars / 1000).toFixed(1)}k chars`;
}

function RagPanel({ onClose }) {
    const { token, theme } = useContext(MyContext);

    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");

    const [selectedDocId, setSelectedDocId] = useState(null);
    const [question, setQuestion] = useState("");
    const [asking, setAsking] = useState(false);
    const [qaHistory, setQaHistory] = useState([]); // { question, answer, sources }[]

    const fileInputRef = useRef(null);
    const pollRef = useRef(null);

    const authHeaders = { Authorization: `Bearer ${token}` };

    const fetchDocuments = async () => {
        try {
            const res = await fetch(`${API_BASE}/rag/documents`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) {
                setDocuments(data);
                // auto-select the first ready document if nothing is selected yet
                if (!selectedDocId) {
                    const firstReady = data.find(d => d.status === "ready");
                    if (firstReady) setSelectedDocId(firstReady.id);
                }
            }
        } catch (err) {
            console.log("Failed to fetch documents:", err);
        } finally {
            setLoadingDocs(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
        // Poll while any document is still "processing" so status flips
        // to "ready"/"failed" without the user refreshing manually.
        pollRef.current = setInterval(() => {
            setDocuments(prev => {
                const stillProcessing = prev.some(d => d.status === "processing");
                if (stillProcessing) fetchDocuments();
                return prev;
            });
        }, 3000);
        return () => clearInterval(pollRef.current);
    }, []);

    // While a document is selected here, send a "time spent on this paper"
    // heartbeat every 30s - this is what feeds the "Time Spent by Paper"
    // donut chart on the Activity dashboard. Only runs while a document is
    // actually selected and this panel is open/visible.
    useEffect(() => {
        if (!selectedDocId) return;

        const HEARTBEAT_SECONDS = 30;
        const interval = setInterval(() => {
            if (document.visibilityState !== "visible") return;
            fetch(`${API_BASE}/activity/heartbeat`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ seconds: HEARTBEAT_SECONDS, documentId: selectedDocId })
            }).catch(err => console.log("Paper heartbeat failed:", err));
        }, HEARTBEAT_SECONDS * 1000);

        return () => clearInterval(interval);
    }, [selectedDocId, token]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = "";

        setUploadError("");
        setUploading(true);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE}/rag/documents`, {
                method: "POST",
                headers: authHeaders,
                body: formData
            });
            const data = await res.json();
            if (!res.ok) {
                setUploadError(data.error || "Upload failed.");
            } else {
                await fetchDocuments();
                setSelectedDocId(data.id);
            }
        } catch (err) {
            setUploadError("Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const deleteDocument = async (docId) => {
        try {
            await fetch(`${API_BASE}/rag/documents/${docId}`, {
                method: "DELETE",
                headers: authHeaders
            });
            setDocuments(prev => prev.filter(d => d.id !== docId));
            if (selectedDocId === docId) {
                setSelectedDocId(null);
                setQaHistory([]);
            }
        } catch (err) {
            console.log("Failed to delete document:", err);
        }
    };

    const askQuestion = async () => {
        if (!question.trim() || !selectedDocId || asking) return;
        const q = question.trim();
        setQuestion("");
        setAsking(true);

        try {
            const res = await fetch(`${API_BASE}/rag/ask`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: selectedDocId, question: q })
            });
            const data = await res.json();
            if (!res.ok) {
                setQaHistory(prev => [...prev, { question: q, answer: `Error: ${data.error || "Something went wrong."}`, sources: [] }]);
            } else {
                setQaHistory(prev => [...prev, { question: q, answer: data.answer, sources: data.sources || [] }]);
            }
        } catch (err) {
            setQaHistory(prev => [...prev, { question: q, answer: "Error: Failed to reach the server.", sources: [] }]);
        } finally {
            setAsking(false);
        }
    };

    const selectedDoc = documents.find(d => d.id === selectedDocId);

    return (
        <div className="ragOverlay" onClick={onClose}>
            <div className="ragPanel" onClick={(e) => e.stopPropagation()}>
                <div className="ragHeader">
                    <h2><i className="fa-solid fa-file-lines"></i> Chat with your documents</h2>
                    <button className="ragCloseBtn" onClick={onClose} title="Close">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="ragBody">
                    <div className="ragSidebarCol">
                        <button
                            className="ragUploadBtn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading
                                ? <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
                                : <><i className="fa-solid fa-upload"></i> Upload PDF or notes</>
                            }
                        </button>
                        <input
                            type="file"
                            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            style={{ display: "none" }}
                        />
                        {uploadError && <p className="ragError">{uploadError}</p>}

                        <div className="ragDocList">
                            {loadingDocs && <p className="ragMuted">Loading documents...</p>}
                            {!loadingDocs && documents.length === 0 && (
                                <p className="ragMuted">No documents yet. Upload a PDF or text file to get started.</p>
                            )}
                            {documents.map(doc => (
                                <div
                                    key={doc.id}
                                    className={"ragDocItem" + (doc.id === selectedDocId ? " ragDocItemActive" : "")}
                                    onClick={() => { setSelectedDocId(doc.id); setQaHistory([]); }}
                                >
                                    <div className="ragDocIcon">
                                        <i className={doc.fileType === "pdf" ? "fa-solid fa-file-pdf" : "fa-solid fa-file-lines"}></i>
                                    </div>
                                    <div className="ragDocInfo">
                                        <span className="ragDocName" title={doc.filename}>{doc.filename}</span>
                                        <span className="ragDocMeta">
                                            {doc.status === "processing" && <><i className="fa-solid fa-spinner fa-spin"></i> Processing</>}
                                            {doc.status === "ready" && <>{doc.chunkCount} chunks &middot; {formatBytes(doc.charCount)}</>}
                                            {doc.status === "failed" && <span className="ragFailed">Failed</span>}
                                        </span>
                                    </div>
                                    <button
                                        className="ragDeleteBtn"
                                        onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                                        title="Delete document"
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="ragChatCol">
                        {!selectedDoc && (
                            <div className="ragEmptyState">
                                <i className="fa-solid fa-file-circle-question"></i>
                                <p>Select or upload a document to start asking questions grounded in it.</p>
                            </div>
                        )}

                        {selectedDoc && selectedDoc.status !== "ready" && (
                            <div className="ragEmptyState">
                                <i className="fa-solid fa-spinner fa-spin"></i>
                                <p>This document is still processing. Hang tight...</p>
                            </div>
                        )}

                        {selectedDoc && selectedDoc.status === "ready" && (
                            <>
                                <div className="ragQaList">
                                    {qaHistory.length === 0 && (
                                        <div className="ragEmptyState">
                                            <i className="fa-solid fa-comments"></i>
                                            <p>Ask anything about <strong>{selectedDoc.filename}</strong>.</p>
                                        </div>
                                    )}
                                    {qaHistory.map((qa, i) => (
                                        <div className="ragQaItem" key={i}>
                                            <div className="ragQuestion"><i className="fa-solid fa-user"></i> {qa.question}</div>
                                            <div className="ragAnswer">
                                                <i className="fa-solid fa-sparkles"></i>
                                                <div>
                                                    <p>{qa.answer}</p>
                                                    {qa.sources && qa.sources.length > 0 && (
                                                        <details className="ragSources">
                                                            <summary>Sources ({qa.sources.length})</summary>
                                                            {qa.sources.map((s, si) => (
                                                                <div className="ragSourceItem" key={si}>
                                                                    <span className="ragSourceScore">match {(s.score * 100).toFixed(0)}%</span>
                                                                    <span>{s.preview}</span>
                                                                </div>
                                                            ))}
                                                        </details>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {asking && (
                                        <div className="ragQaItem">
                                            <div className="ragAnswer"><i className="fa-solid fa-spinner fa-spin"></i> Thinking...</div>
                                        </div>
                                    )}
                                </div>

                                <div className="ragInputBox">
                                    <input
                                        placeholder={`Ask a question about ${selectedDoc.filename}...`}
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                                    />
                                    <button onClick={askQuestion} disabled={asking || !question.trim()}>
                                        <i className="fa-solid fa-paper-plane"></i>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RagPanel;
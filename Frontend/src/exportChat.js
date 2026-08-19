// exportChat.js
// Utilities to export the current chat conversation as a Markdown (.md)
// file or a PDF (.pdf) file. Both work entirely client-side.

import { jsPDF } from "jspdf";

const timestamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
};

const downloadBlob = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Export the given chat messages as a Markdown file and trigger a download.
 * @param {Array<{role:string, content:string, image?:string}>} chats
 */
export function exportChatAsMarkdown(chats) {
    if (!chats || chats.length === 0) {
        alert("There's no conversation yet to export.");
        return;
    }

    const lines = [`# Nexus AI - Chat Export`, `_Exported on ${new Date().toLocaleString()}_`, ""];

    chats.forEach((chat) => {
        const speaker = chat.role === "user" ? "**You**" : "**Nexus AI**";
        lines.push(`### ${speaker}`);
        if (chat.image) {
            lines.push(`_[Attached image]_`);
        }
        if (chat.content) {
            lines.push(chat.content);
        }
        lines.push("");
    });

    downloadBlob(lines.join("\n"), `nexus-chat-${timestamp()}.md`, "text/markdown;charset=utf-8");
}

/**
 * Export the given chat messages as a PDF file and trigger a download.
 * @param {Array<{role:string, content:string, image?:string}>} chats
 */
export function exportChatAsPDF(chats) {
    if (!chats || chats.length === 0) {
        alert("There's no conversation yet to export.");
        return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const ensureSpace = (neededHeight) => {
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Nexus AI - Chat Export", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Exported on ${new Date().toLocaleString()}`, margin, y);
    doc.setTextColor(0);
    y += 24;

    chats.forEach((chat) => {
        const isUser = chat.role === "user";
        const speaker = isUser ? "You" : "Nexus AI";

        ensureSpace(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(isUser ? 30 : 10, isUser ? 90 : 110, isUser ? 200 : 60);
        doc.text(speaker, margin, y);
        doc.setTextColor(0);
        y += 16;

        if (chat.image) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            ensureSpace(14);
            doc.text("[Attached image]", margin, y);
            y += 14;
        }

        if (chat.content) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(11);
            const textLines = doc.splitTextToSize(chat.content, maxWidth);
            textLines.forEach((line) => {
                ensureSpace(15);
                doc.text(line, margin, y);
                y += 15;
            });
        }

        y += 12; // spacing between messages
    });

    doc.save(`nexus-chat-${timestamp()}.pdf`);
}

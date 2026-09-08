import "./ChatAnalytics.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const API_BASE = "http://localhost:8080/api";
const SENTIMENT_COLORS = { positive: "#22c55e", neutral: "#8b5cf6", negative: "#ef4444" };
const QUESTION_LABELS = {
    what: "What", how: "How", why: "Why", when: "When", where: "Where",
    who: "Who", yes_no: "Yes/No", other_question: "Other Question", statement: "Statement"
};

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatHour(h) {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function ChatAnalytics({ onClose }) {
    const { token } = useContext(MyContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`${API_BASE}/analytics/chat-overview`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || "Failed to load chat analytics.");
                setData(result);
            } catch (err) {
                console.log(err);
                setError(err.message || "Failed to load chat analytics.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const hourData = data
        ? Array.from({ length: 24 }, (_, h) => ({ hour: h, isMax: h === data.mostActiveHour }))
        : [];

    const sentimentPieData = data
        ? Object.entries(data.sentimentDistribution).map(([name, value]) => ({ name, value }))
        : [];

    const questionTypeData = data
        ? Object.entries(data.questionTypes)
            .map(([type, count]) => ({ type: QUESTION_LABELS[type] || type, count }))
            .sort((a, b) => b.count - a.count)
        : [];

    const maxKeywordValue = data?.keywords?.length ? data.keywords[0].value : 1;

    return (
        <div className="activityOverlay" onClick={onClose}>
            <div className="activityPanel" onClick={(e) => e.stopPropagation()}>
                <div className="activityHeader">
                    <h2><i className="fa-solid fa-comments"></i> Chat Analytics</h2>
                    <button className="activityCloseBtn" onClick={onClose} title="Close">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="activityBody">
                    {loading && (
                        <div className="activityEmptyState">
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <p>Crunching your chat data...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="activityEmptyState">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && data && (
                        <>
                            {/* ---- Stat cards ---- */}
                            <div className="activityStats">
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.totalMessages}</span>
                                    <span className="activityStatLabel">Total Messages</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.chatStreak}</span>
                                    <span className="activityStatLabel">Day Streak</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.bounceRate}%</span>
                                    <span className="activityStatLabel">Bounce Rate</span>
                                </div>
                            </div>
                            <div className="activityStats">
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{formatHour(data.mostActiveHour)}</span>
                                    <span className="activityStatLabel">Most Active Hour</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.mostActiveDay}</span>
                                    <span className="activityStatLabel">Most Active Day</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.avgConversationDurationMinutes}m</span>
                                    <span className="activityStatLabel">Avg Conversation</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{data.avgResponseLength}w</span>
                                    <span className="activityStatLabel">Avg AI Response</span>
                                </div>
                            </div>

                            {data.longestConversation && (
                                <div className="activityHighlight">
                                    <i className="fa-solid fa-trophy"></i>
                                    <span>
                                        Longest conversation: <strong>{data.longestConversation.title}</strong> —
                                        {" "}{data.longestConversation.messageCount} messages
                                        {data.longestConversation.durationMinutes > 0 && ` over ${data.longestConversation.durationMinutes} minutes`}.
                                    </span>
                                </div>
                            )}

                            {/* ---- Messages per day ---- */}
                            <div className="activityChartSection">
                                <h3>Messages Per Day (Last 14 Days)</h3>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={data.messagesPerDay}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "var(--text-low)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: "var(--text-low)", fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
                                        <Tooltip
                                            labelFormatter={formatDate}
                                            contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ---- Most active hour ---- */}
                            <div className="activityChartSection">
                                <h3>Activity by Hour of Day</h3>
                                <ResponsiveContainer width="100%" height={140}>
                                    <BarChart data={hourData}>
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(h) => (h % 6 === 0 ? formatHour(h) : "")}
                                            tick={{ fill: "var(--text-low)", fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            labelFormatter={formatHour}
                                            formatter={() => [null, null]}
                                            contentStyle={{ display: "none" }}
                                        />
                                        <Bar dataKey={() => 1} radius={[3, 3, 0, 0]}>
                                            {hourData.map((d, i) => (
                                                <Cell key={i} fill={d.isMax ? "#8b5cf6" : "var(--glass)"} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                <p className="activityMuted" style={{ textAlign: "center", fontSize: "0.78rem" }}>
                                    Peak activity around {formatHour(data.mostActiveHour)}
                                </p>
                            </div>

                            {/* ---- Sentiment trend ---- */}
                            <div className="activityChartSection">
                                <h3>Sentiment Trend (Last 14 Days)</h3>
                                <ResponsiveContainer width="100%" height={140}>
                                    <LineChart data={data.sentimentTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "var(--text-low)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[-1, 1]} tick={{ fill: "var(--text-low)", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                                        <Tooltip
                                            labelFormatter={formatDate}
                                            contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Line type="monotone" dataKey="sentiment" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ---- Sentiment distribution + Question types side by side ---- */}
                            <div className="activityDonutRow">
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: "0.9rem", marginBottom: 10 }}>Overall Sentiment</h3>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <PieChart>
                                            <Pie data={sentimentPieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2}>
                                                {sentimentPieData.map((entry) => (
                                                    <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="activityDonutLegend">
                                    {sentimentPieData.map(s => (
                                        <div className="activityLegendItem" key={s.name}>
                                            <span className="activityLegendDot" style={{ background: SENTIMENT_COLORS[s.name] }}></span>
                                            <span className="activityLegendName" style={{ textTransform: "capitalize" }}>{s.name}</span>
                                            <span className="activityLegendValue">{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ---- Question type breakdown ---- */}
                            <div className="activityChartSection">
                                <h3>Question Types</h3>
                                <ResponsiveContainer width="100%" height={Math.max(140, questionTypeData.length * 26)}>
                                    <BarChart data={questionTypeData} layout="vertical" margin={{ left: 20 }}>
                                        <XAxis type="number" tick={{ fill: "var(--text-low)", fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="type" type="category" tick={{ fill: "var(--text-mid)", fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
                                        <Tooltip contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }} />
                                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ---- Word cloud (top keywords, sized by frequency) ---- */}
                            <div className="activityChartSection">
                                <h3>What You've Been Asking About</h3>
                                {data.keywords.length === 0 ? (
                                    <p className="activityChartEmpty">Not enough chat data yet.</p>
                                ) : (
                                    <div className="activityWordCloud">
                                        {data.keywords.map(k => {
                                            const ratio = k.value / maxKeywordValue;
                                            const fontSize = 12 + ratio * 20; // 12px to 32px
                                            const opacity = 0.55 + ratio * 0.45;
                                            return (
                                                <span
                                                    key={k.text}
                                                    className="activityWordCloudItem"
                                                    style={{ fontSize: `${fontSize}px`, opacity }}
                                                    title={`${k.value} times`}
                                                >
                                                    {k.text}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChatAnalytics;
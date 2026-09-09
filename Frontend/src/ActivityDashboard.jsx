import "./ActivityDashboard.css";
import { API_BASE_URL } from "./config.js";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from "recharts";

const API_BASE = `${API_BASE_URL}/api`;
const DONUT_COLORS = ["#8b5cf6", "#6366f1", "#ec4899", "#0ea5e9", "#22c55e", "#f59e0b"];

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function heatColor(count) {
    if (count === 0) return "var(--bg-panel-2)";
    if (count <= 2) return "rgba(139,92,246,0.35)";
    if (count <= 5) return "rgba(139,92,246,0.6)";
    if (count <= 9) return "rgba(139,92,246,0.8)";
    return "var(--accent-1)";
}

function ActivityDashboard({ onClose }) {
    const { token } = useContext(MyContext);

    const [papers, setPapers] = useState([]);
    const [comparison, setComparison] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [timeByPaper, setTimeByPaper] = useState([]);
    const [heatmap, setHeatmap] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const authHeaders = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const [papersRes, comparisonRes, timelineRes, timeByPaperRes, heatmapRes] = await Promise.all([
                    fetch(`${API_BASE}/activity/by-paper`, { headers: authHeaders }),
                    fetch(`${API_BASE}/activity/comparison`, { headers: authHeaders }),
                    fetch(`${API_BASE}/activity/timeline`, { headers: authHeaders }),
                    fetch(`${API_BASE}/activity/time-by-paper`, { headers: authHeaders }),
                    fetch(`${API_BASE}/activity/heatmap`, { headers: authHeaders })
                ]);

                const [papersData, comparisonData, timelineData, timeByPaperData, heatmapData] = await Promise.all([
                    papersRes.json(), comparisonRes.json(), timelineRes.json(), timeByPaperRes.json(), heatmapRes.json()
                ]);

                if (!papersRes.ok) throw new Error(papersData.error || "Failed to load paper activity.");
                if (!comparisonRes.ok) throw new Error(comparisonData.error || "Failed to load comparison.");

                setPapers(papersData);
                setComparison(comparisonData);
                setTimeline(timelineRes.ok ? timelineData : []);
                setTimeByPaper(timeByPaperRes.ok ? timeByPaperData : []);
                setHeatmap(heatmapRes.ok ? heatmapData : []);
            } catch (err) {
                console.log(err);
                setError(err.message || "Failed to load your activity.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totalPapers = papers.length;
    const totalQueries = papers.reduce((sum, p) => sum + (p.queryCount || 0), 0);
    const mostActivePaper = papers.length
        ? [...papers].sort((a, b) => b.queryCount - a.queryCount)[0]
        : null;

    // Group heatmap days into weeks (columns of 7) for the grid layout
    const heatmapWeeks = [];
    for (let i = 0; i < heatmap.length; i += 7) {
        heatmapWeeks.push(heatmap.slice(i, i + 7));
    }

    return (
        <div className="activityOverlay" onClick={onClose}>
            <div className="activityPanel" onClick={(e) => e.stopPropagation()}>
                <div className="activityHeader">
                    <h2><i className="fa-solid fa-chart-simple"></i> My Research Activity</h2>
                    <button className="activityCloseBtn" onClick={onClose} title="Close">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="activityBody">
                    {loading && (
                        <div className="activityEmptyState">
                            <i className="fa-solid fa-spinner fa-spin"></i>
                            <p>Loading your activity...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="activityEmptyState">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            <div className="activityStats">
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{totalPapers}</span>
                                    <span className="activityStatLabel">Papers Researched</span>
                                </div>
                                <div className="activityStatCard">
                                    <span className="activityStatValue">{totalQueries}</span>
                                    <span className="activityStatLabel">Questions Asked</span>
                                </div>
                                {comparison && (
                                    <div className="activityStatCard">
                                        <span className={
                                            "activityStatValue" +
                                            (comparison.percentChange >= 0 ? " activityStatUp" : " activityStatDown")
                                        }>
                                            {comparison.percentChange >= 0 ? "+" : ""}{comparison.percentChange}%
                                        </span>
                                        <span className="activityStatLabel">vs Last Week</span>
                                    </div>
                                )}
                            </div>

                            {mostActivePaper && (
                                <div className="activityHighlight">
                                    <i className="fa-solid fa-sparkles"></i>
                                    <span>
                                        You've been most active on <strong>{mostActivePaper.filename}</strong> —
                                        {" "}{mostActivePaper.queryCount} question{mostActivePaper.queryCount === 1 ? "" : "s"} asked.
                                    </span>
                                </div>
                            )}

                            {/* ---- Daily activity trend (area chart) ---- */}
                            <div className="activityChartSection">
                                <h3>Daily Activity (Last 14 Days)</h3>
                                {timeline.every(d => d.minutes === 0) ? (
                                    <p className="activityChartEmpty">Not enough time-tracking data yet.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={180}>
                                        <AreaChart data={timeline}>
                                            <defs>
                                                <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
                                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={formatDate}
                                                tick={{ fill: "var(--text-low)", fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fill: "var(--text-low)", fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={30}
                                            />
                                            <Tooltip
                                                formatter={(value) => [`${value} min`, "Time spent"]}
                                                labelFormatter={formatDate}
                                                contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }}
                                            />
                                            <Area type="monotone" dataKey="minutes" stroke="#8b5cf6" strokeWidth={2} fill="url(#timelineFill)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* ---- Time by paper (donut chart) ---- */}
                            <div className="activityChartSection">
                                <h3>Time Spent by Paper</h3>
                                {timeByPaper.length === 0 ? (
                                    <p className="activityChartEmpty">Not enough time-tracking data yet.</p>
                                ) : (
                                    <div className="activityDonutRow">
                                        <ResponsiveContainer width={160} height={160}>
                                            <PieChart>
                                                <Pie
                                                    data={timeByPaper}
                                                    dataKey="minutes"
                                                    nameKey="filename"
                                                    innerRadius={45}
                                                    outerRadius={75}
                                                    paddingAngle={2}
                                                >
                                                    {timeByPaper.map((entry, i) => (
                                                        <Cell key={entry.documentId} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value) => [`${value} min`, "Time spent"]}
                                                    contentStyle={{ background: "var(--bg-panel-2)", border: "1px solid var(--glass-border)", borderRadius: 8, fontSize: 12 }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="activityDonutLegend">
                                            {timeByPaper.map((p, i) => (
                                                <div className="activityLegendItem" key={p.documentId}>
                                                    <span className="activityLegendDot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}></span>
                                                    <span className="activityLegendName" title={p.filename}>{p.filename}</span>
                                                    <span className="activityLegendValue">{p.minutes}m</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ---- Calendar heatmap ---- */}
                            <div className="activityChartSection">
                                <h3>Activity Heatmap (Last 90 Days)</h3>
                                <div className="activityHeatmapGrid">
                                    {heatmapWeeks.map((week, wi) => (
                                        <div className="activityHeatmapCol" key={wi}>
                                            {week.map(day => (
                                                <div
                                                    key={day.date}
                                                    className="activityHeatmapCell"
                                                    style={{ background: heatColor(day.count) }}
                                                    title={`${formatDate(day.date)}: ${day.count} action${day.count === 1 ? "" : "s"}`}
                                                ></div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="activityTableSection">
                                <h3>Paper Activity</h3>

                                {papers.length === 0 ? (
                                    <div className="activityEmptyState">
                                        <i className="fa-solid fa-file-circle-question"></i>
                                        <p>No document activity yet. Upload a paper in "Chat with your documents" and ask it a question to see your activity here.</p>
                                    </div>
                                ) : (
                                    <div className="activityTableWrap">
                                        <table className="activityTable">
                                            <thead>
                                                <tr>
                                                    <th>Paper</th>
                                                    <th>Questions</th>
                                                    <th>Last Accessed</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {papers.map((p) => (
                                                    <tr key={p.documentId}>
                                                        <td className="activityPaperCell">
                                                            <i className={p.fileType === "pdf" ? "fa-solid fa-file-pdf" : "fa-solid fa-file-lines"}></i>
                                                            <span title={p.filename}>{p.filename}</span>
                                                        </td>
                                                        <td>{p.queryCount}</td>
                                                        <td className="activityMuted">{formatDate(p.lastAccessed)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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

export default ActivityDashboard;
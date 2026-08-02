import "./Sidebar.css";

function Sidebar(){
    return (
        <section className="sidebar">
            <button>
                <img></img>
                <i className="fa-solid fa-pen-to-square"></i>
            </button>
            {/* history */}
            <ul className="history">
                <li>history 1</li>
                <li>history 2</li>
                <li>history 3</li>
            </ul>
            {/* sign */}
            <div className="sign">
                <p>By NEXUS TEAM</p>
            </div>
        </section>
    )
}
 export default Sidebar;
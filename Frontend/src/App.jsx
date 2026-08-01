import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";

function App() {
  const providerValue={};
  return (
    <div className="app">
      <MyContext.provider value={providerValue}>
        <Sidebar></Sidebar>
        <ChatWindow></ChatWindow>
      </MyContext.provider>
    </div>
  )
}

export default App

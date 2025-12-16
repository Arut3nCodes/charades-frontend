import DrawingCanvas from "./DrawingCanvas";
import GlobalChat from "./components/GlobalChat";

export default function App() {
    return (
        <div className="app-layout">
            <div className="canvas-container">
                <DrawingCanvas />
            </div>

            <div className="chat-container">
                <GlobalChat />
            </div>
        </div>
    );
}

import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./routes/appRoutes";
import Header from "./components/header/header";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <Router>
          <AppRoutes />
        </Router>
      </main>
    </div>
  );
}

export default App;

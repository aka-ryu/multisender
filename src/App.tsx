import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import logo from "./logo.svg";
import AppRoutes from "./routes/appRoutes";

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header"></header>
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;

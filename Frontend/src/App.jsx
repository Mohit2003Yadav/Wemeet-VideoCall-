import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './Pages/landing';
import Authentication from './Pages/authentication';
import { AuthProvider } from './context/AuthContext';
import VideoMeetComponent from './Pages/VideoMeet';
import HistoryComponent from './Pages/History';
import HomeComponent from './Pages/Home';

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Authentication />} />
            <Route path="/history" element={<HistoryComponent />} />
            <Route path="/home" element={<HomeComponent />} />
            <Route path="/:url" element={<VideoMeetComponent />} />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;
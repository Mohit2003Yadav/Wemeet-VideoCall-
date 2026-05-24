import React, { useContext, useState } from 'react';
import withAuth from '../../utils/WithAuth';
import { useNavigate } from 'react-router-dom';
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import { AuthContext } from '../context/AuthContext';

function HomeComponent() {

    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const { addToUserHistory } = useContext(AuthContext);

    const handleJoinVideoCall = async () => {
        if (!meetingCode.trim()) {
            alert("Enter meeting code 😅");
            return;
        }

        try {
            await addToUserHistory(meetingCode);
            navigate(`/${meetingCode}`);
        } catch (error) {
            console.error("Join error:", error);
        }
    };

    return (
        <>
            <div className="navBar">
                <div style={{ display: "flex", alignItems: "center" }}>
                    <h2>Connectify</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={() => navigate("/history")}>
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    <Button onClick={() => {
                        localStorage.removeItem("token");
                        navigate("/auth");
                    }}>
                        Logout
                    </Button>
                </div>
            </div>

            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>
                            “Connect Beyond Boundaries.” 🌍 <br />
                            “Where Conversations Come Alive.”
                        </h2>

                        <div style={{ display: 'flex', gap: "10px", margin: "20px" }}>
                            <TextField
                                onChange={(e) => setMeetingCode(e.target.value)}
                                label="Meeting Code"
                                variant="outlined"
                            />
                            <Button onClick={handleJoinVideoCall} variant='contained'>
                                Join Meeting
                            </Button>
                        </div>
                    </div>
                </div>

                <div className='rightPanel'>
                    <img src='/Homelogo.png' alt="Home Logo" />
                </div>
            </div>
        </>
    );
}

const ProtectedHome = withAuth(HomeComponent);
export default ProtectedHome;
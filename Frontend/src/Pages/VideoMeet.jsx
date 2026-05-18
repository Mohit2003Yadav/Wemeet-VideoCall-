import React, { useEffect, useRef, useState } from 'react'
import io from "socket.io-client";
import { Badge, IconButton, TextField } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'
import server from "../environment";

const server_url = server;
var connections = {};
const peerConfigConnections = {
    "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }]
}

export default function VideoMeetComponent() {

    const socketRef = useRef();
    const socketIdRef = useRef();
    const localVideoref = useRef();
    const videoRef = useRef([]);
    const pendingIceCandidatesRef = useRef({});

    const [videoAvailable, setVideoAvailable] = useState(false);
    const [audioAvailable, setAudioAvailable] = useState(false);
    const [video, setVideo] = useState(false);
    const [audio, setAudio] = useState(false);
    const [screen, setScreen] = useState(false);
    const [showModal, setModal] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState("");
    const [newMessages, setNewMessages] = useState(0);
    const [askForUsername, setAskForUsername] = useState(true);
    const [username, setUsername] = useState("");
    const [videos, setVideos] = useState([]);

    // ─── Silence / Black helpers ──────────────────────────────────────────────
    const silence = () => {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    }

    const black = ({ width = 640, height = 480 } = {}) => {
        const canvas = Object.assign(document.createElement("canvas"), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        const stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    }

    const blackSilence = (...args) => new MediaStream([black(...args), silence()]);

    const showRemoteStream = (remoteId, incomingStream) => {
        setVideos((prev) => {
            const exists = prev.some((v) => v.socketId === remoteId);
            const next = exists
                ? prev.map((v) => v.socketId === remoteId ? { ...v, stream: incomingStream } : v)
                : [...prev, { socketId: remoteId, stream: incomingStream, autoplay: true, playsinline: true }];
            videoRef.current = next;
            return next;
        });
    };

    const attachStreamToPeer = (peer, stream) => {
        if (!peer || !stream) return;

        if (peer.addTrack) {
            const existingTrackIds = peer.getSenders()
                .map((sender) => sender.track?.id)
                .filter(Boolean);

            stream.getTracks().forEach((track) => {
                if (!existingTrackIds.includes(track.id)) {
                    peer.addTrack(track, stream);
                }
            });
            return;
        }

        peer.addStream(stream);
    };

    // ─── Permissions ─────────────────────────────────────────────────────────
    const getPermissions = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('mediaDevices API not available. Use localhost or HTTPS.');
                setVideoAvailable(false);
                setAudioAvailable(false);
                setScreenAvailable(false);
                return;
            }

            let videoAllowed = false;
            let audioAllowed = false;

            try {
                const vs = await navigator.mediaDevices.getUserMedia({ video: true });
                vs.getTracks().forEach(t => t.stop());
                videoAllowed = true;
            } catch (e) { console.warn('Video denied', e); }

            try {
                const as = await navigator.mediaDevices.getUserMedia({ audio: true });
                as.getTracks().forEach(t => t.stop());
                audioAllowed = true;
            } catch (e) { console.warn('Audio denied', e); }

            setVideoAvailable(videoAllowed);
            setAudioAvailable(audioAllowed);
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

            // Show preview in lobby
            if (videoAllowed || audioAllowed) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: videoAllowed,
                    audio: audioAllowed
                });
                window.localStream = stream;
                if (localVideoref.current) {
                    localVideoref.current.srcObject = stream;
                }
            }
        } catch (error) {
            console.error('getPermissions error:', error);
        }
    };

    useEffect(() => {
        getPermissions();
    }, []);

    // ─── getUserMedia ─────────────────────────────────────────────────────────
    const getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { console.log(e); }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            attachStreamToPeer(connections[id], window.localStream);
            createOfferForPeer(id);
        }

        stream.getTracks().forEach(track => {
            track.onended = () => {
                setVideo(false);
                setAudio(false);

                try {
                    localVideoref.current.srcObject.getTracks().forEach(t => t.stop());
                } catch (e) { console.log(e); }

                window.localStream = blackSilence();
                localVideoref.current.srcObject = window.localStream;

                for (let id in connections) {
                    attachStreamToPeer(connections[id], window.localStream);
                    createOfferForPeer(id);
                }
            };
        });
    }

    const getUserMedia = () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('mediaDevices not available. Use localhost or HTTPS.');
            return;
        }
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video, audio })
                .then(getUserMediaSuccess)
                .catch(e => {
                    console.log(e);
                    getUserMediaSuccess(blackSilence());
                });
        } else {
            try {
                localVideoref.current.srcObject.getTracks().forEach(track => track.stop());
            } catch (e) { }
            getUserMediaSuccess(blackSilence());
        }
    }

    // Trigger getUserMedia whenever video/audio state changes (after joining)
    useEffect(() => {
        if (video !== undefined && audio !== undefined && !askForUsername) {
            getUserMedia();
        }
    }, [video, audio]);

    // ─── Screen Share ─────────────────────────────────────────────────────────
    const getDisplayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) { console.log(e); }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            attachStreamToPeer(connections[id], window.localStream);
            createOfferForPeer(id);
        }

        stream.getTracks().forEach(track => {
            track.onended = () => {
                setScreen(false);
                try {
                    localVideoref.current.srcObject.getTracks().forEach(t => t.stop());
                } catch (e) { console.log(e); }

                window.localStream = blackSilence();
                localVideoref.current.srcObject = window.localStream;
                getUserMedia();
            };
        });
    }

    const getDisplayMedia = () => {
        if (screen && navigator.mediaDevices.getDisplayMedia) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                .then(getDisplayMediaSuccess)
                .catch(e => console.log(e));
        }
    }

    useEffect(() => {
        if (screen !== undefined && !askForUsername) {
            getDisplayMedia();
        }
    }, [screen]);

    // ─── WebRTC signaling ─────────────────────────────────────────────────────
    const gotMessageFromServer = (fromId, message) => {
        const signal = JSON.parse(message);
        if (fromId === socketIdRef.current) return;

        const peer = ensurePeerConnection(fromId);
        if (!peer) return;

        if (signal.sdp) {
            peer.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                const queuedCandidates = pendingIceCandidatesRef.current[fromId] || [];
                queuedCandidates.forEach((candidate) => {
                    peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.log(e));
                });
                delete pendingIceCandidatesRef.current[fromId];

                if (signal.sdp.type === 'offer') {
                    peer.createAnswer().then((description) => {
                        peer.setLocalDescription(description).then(() => {
                            socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': peer.localDescription }));
                        }).catch(e => console.log(e));
                    }).catch(e => console.log(e));
                }
            }).catch(e => console.log(e));
        }

        if (signal.ice) {
            if (!peer.remoteDescription) {
                pendingIceCandidatesRef.current[fromId] = [
                    ...(pendingIceCandidatesRef.current[fromId] || []),
                    signal.ice,
                ];
                return;
            }

            peer.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
        }
    }

    const ensurePeerConnection = (remoteId) => {
        if (remoteId === socketIdRef.current) return null;
        if (connections[remoteId]) return connections[remoteId];

        const peer = new RTCPeerConnection(peerConfigConnections);
        connections[remoteId] = peer;

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit("signal", remoteId, JSON.stringify({ ice: event.candidate }));
            }
        };

        peer.ontrack = (event) => {
            if (event.streams?.[0]) {
                showRemoteStream(remoteId, event.streams[0]);
            }
        };

        peer.onaddstream = (event) => {
            if (event.stream) {
                showRemoteStream(remoteId, event.stream);
            }
        };

        if (window.localStream) {
            attachStreamToPeer(peer, window.localStream);
        }

        return peer;
    };

    const createOfferForPeer = (remoteId) => {
        const peer = ensurePeerConnection(remoteId);
        if (!peer) return;

        peer.createOffer().then((description) => {
            peer.setLocalDescription(description).then(() => {
                socketRef.current.emit('signal', remoteId, JSON.stringify({ 'sdp': peer.localDescription }));
            }).catch(e => console.log(e));
        }).catch(e => console.log(e));
    };

    // ─── Socket ───────────────────────────────────────────────────────────────
    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });
        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on("existing-users", (users) => {
            users.forEach((remoteId) => createOfferForPeer(remoteId));
        });

        socketRef.current.on('connect', () => {
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit('join-call', window.location.href);

            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                setVideos((prev) => {
                    const next = prev.filter((v) => v.socketId !== id);
                    videoRef.current = next;
                    return next;
                });
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            });

            socketRef.current.on('user-connected', (remoteId) => {
                ensurePeerConnection(remoteId);
            });
        });
    }

    // ─── Button handlers ──────────────────────────────────────────────────────
    const handleVideo = () => setVideo(v => !v);
    const handleAudio = () => setAudio(a => !a);
    const handleScreen = () => setScreen(s => !s);

    const handleEndCall = () => {
        try {
            localVideoref.current.srcObject.getTracks().forEach(track => track.stop());
        } catch (e) { }
        window.location.href = "/home";
    }

    const openChat = () => { setModal(true); setNewMessages(0); }
    const closeChat = () => setModal(false);
    const handleMessage = (e) => setMessage(e.target.value);

    const addMessage = (data, sender, socketIdSender) => {
        if (socketIdSender === socketIdRef.current) {
            return;
        }

        setMessages(prev => [...prev, { sender, data }]);
        setNewMessages(prev => prev + 1);
    };

    const sendMessage = () => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return;
        }

        setMessages(prev => [...prev, { sender: username, data: trimmedMessage }]);
        socketRef.current?.emit('chat-message', trimmedMessage, username);
        setMessage("");
    }

    // ─── Connect (lobby button) ───────────────────────────────────────────────
    const getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();
    }

    const connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div>
            {askForUsername ? (
                <div>
                    <h2>Enter into Lobby</h2>
                    <TextField
                        label="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        variant="outlined"
                    />
                    <Button variant="contained" onClick={connect}>Connect</Button>
                    <div>
                        <video ref={localVideoref} autoPlay muted></video>
                    </div>
                </div>
            ) : (
                <div className={styles.meetVideoContainer}>
                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio ? <MicIcon /> : <MicOffIcon />}
                        </IconButton>
                        {screenAvailable && (
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton>
                        )}
                        <Badge badgeContent={newMessages} max={999} color='secondary'>
                            <IconButton onClick={openChat} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton>
                        </Badge>
                    </div>

                    <div className={`${styles.remoteVideos} ${showModal ? styles.remoteVideosWithChat : ""}`}>
                        {videos.length === 0 ? (
                            <div className={styles.waitingState}>
                                <h2>Waiting for others to join</h2>
                                <p>Share this meeting link with another user.</p>
                            </div>
                        ) : (
                            videos.map((v) => (
                                <div className={styles.conferenceView} key={v.socketId}>
                                    <video
                                        data-socket={v.socketId}
                                        ref={ref => { if (ref && v.stream) ref.srcObject = v.stream; }}
                                        autoPlay
                                        playsInline
                                    ></video>
                                </div>
                            ))
                        )}
                    </div>

                    <div className={styles.localPreview}>
                        <video className={styles.meetUserVideo} ref={localVideoref} autoPlay muted playsInline></video>
                        <span>You</span>
                    </div>

                    {showModal && (
                        <div className={styles.chatContainer}>
                            <div className={styles.chatHeader}>
                                <span>Chat</span>
                                <button className={styles.chatCloseButton} onClick={closeChat}>×</button>
                            </div>
                            <div className={styles.chatMessages}>
                                {messages.map((m, idx) => (
                                    <div key={idx} className={m.sender === username ? styles.chatMessageSelf : styles.chatMessageOther}>
                                        <div className={styles.chatMessageSender}>{m.sender}</div>
                                        <div className={styles.chatMessageText}>{m.data}</div>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.chatInputContainer}>
                                <TextField
                                    size="small"
                                    placeholder="Type a message..."
                                    value={message}
                                    onChange={handleMessage}
                                    onKeyDown={(e) => { if (e.key === "Enter" && message.trim()) sendMessage(); }}
                                    className={styles.chatInput}
                                />
                                <Button variant="contained" color="primary" onClick={sendMessage} disabled={!message.trim()}>
                                    Send
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

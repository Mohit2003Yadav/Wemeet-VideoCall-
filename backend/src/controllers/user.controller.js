import bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";

import {User} from "../model/userModel.js";
import {Meeting} from "../model/meetingModel.js";

/* =========================
   LOGIN CONTROLLER
========================= */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "Username and password are required" });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(httpStatus.UNAUTHORIZED)
        .json({ message: "Invalid username or password" });
    }

    const token = crypto.randomBytes(64).toString("hex");
    user.token = token;
    await user.save();

    return res.status(httpStatus.OK).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
      },
    });

  } catch (error) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Error logging in", error });
  }
};


/* =========================
   REGISTER CONTROLLER
========================= */
const register = async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      username,
      password: hashedPassword,
    });

    await newUser.save();

    return res
      .status(httpStatus.CREATED)
      .json({ message: "User registered successfully" });

  } catch (error) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Error registering user", error });
  }
};


/* =========================
   GET USER HISTORY
========================= */
const getUserHistory = async (req, res) => {
  // Prefer explicit token in query, but also support Bearer token header
  const authHeader = req.headers.authorization || "";
  const headerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = req.query.token || headerToken;

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Match Meeting schema field name: userId
    const meetings = await Meeting.find({ userId: user.username });

    return res.status(200).json(meetings);

  } catch (e) {
    return res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};


/* =========================
   ADD TO HISTORY
========================= */
const addToHistory = async (req, res) => {
  // Prefer explicit token in body, but also support Bearer token header
  const authHeader = req.headers.authorization || "";
  const headerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = req.body.token || headerToken;
  const { meeting_code } = req.body;

  try {
    const user = await User.findOne({ token });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Match Meeting schema field name: userId
    const newMeeting = new Meeting({
      userId: user.username,
      meetingCode: meeting_code,
    });

    await newMeeting.save();

    return res
      .status(httpStatus.CREATED)
      .json({ message: "Added code to history" });

  } catch (e) {
    // Handle duplicate meetingCode gracefully (user re-joining same meeting)
    if (e.code === 11000) {
      return res
        .status(httpStatus.OK)
        .json({ message: "Meeting already in history" });
    }

    return res
      .status(500)
      .json({ message: `Something went wrong: ${e.message}` });
  }
};

export { login, register, addToHistory, getUserHistory };
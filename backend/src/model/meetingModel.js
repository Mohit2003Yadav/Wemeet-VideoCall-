import mongoose, { Schema } from "mongoose";

const meetingSchema=new mongoose.Schema({    
    userId: {
        type: String,
        
    },  
   meetingCode: {
        type: String,   
        required: true,
        unique: true
    },  
    date:{
        type: Date,
        required: true,
        default: Date.now
    }
}, { timestamps: true });   
export const Meeting = mongoose.model("Meeting", meetingSchema);


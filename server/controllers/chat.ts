import { Request, Response } from "express";
import { storage } from "../storage";
import { insertChatMessageSchema } from "@shared/schema";
import { groqService } from "../services/groq";

export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const messages = await storage.getChatMessages();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
};

export const createChatMessage = async (req: Request, res: Response) => {
  try {
    const messageData = insertChatMessageSchema.parse(req.body);
    const message = await storage.createChatMessage(messageData);
    res.json(message);
  } catch (error) {
    res.status(400).json({ error: 'Invalid message data' });
  }
};

export const transcribeVoice = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Security: Validate mime type
    const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only audio files are allowed.' });
    }

    // Security: File size limit is handled by multer configuration in routes.ts, 
    // but we can add a secondary check here if needed.
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }

    const transcription = await groqService.transcribeAudio(req.file.buffer);
    res.json({ transcription });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
};

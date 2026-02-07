
import { GoogleGenAI, Type } from "@google/genai";
import { JarType, AIAnalysisResult, JarBalance, User, Transaction } from "../types";

export const analyzeTransactionText = async (text: string, history: Transaction[]): Promise<AIAnalysisResult | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this Vietnamese/English spending text: "${text}". 
      Context history: ${JSON.stringify(history.slice(0, 5))}.
      Return JSON object mapping to the transaction. 
      Note: if it's income, isExpense is false. jarType should be one of: NEC, LTS, EDU, PLAY, FFA, GIVE.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["create", "update", "delete"] },
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            jarType: { type: Type.STRING, enum: Object.values(JarType) },
            isExpense: { type: Type.BOOLEAN }
          },
          required: ["action", "amount"]
        }
      }
    });
    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};

export const importTransactionsAI = async (rawText: string): Promise<Partial<Transaction>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a financial data extractor. Parse the following raw text/document content into a JSON array of financial transactions.
      
      Content: "${rawText}"
      
      Instructions:
      1. Extract every transaction possible.
      2. For each, determine:
         - description: string
         - amount: number (VND equivalent)
         - type: 'income' or 'expense'
         - jarType: 'NEC' | 'LTS' | 'EDU' | 'PLAY' | 'FFA' | 'GIVE' (Choose based on description context)
         - timestamp: number (Unix epoch ms if date is found, otherwise null)
      
      Return ONLY a valid JSON array. If no data found, return [].`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['income', 'expense'] },
              jarType: { type: Type.STRING, enum: Object.values(JarType) },
              timestamp: { type: Type.NUMBER }
            },
            required: ["description", "amount", "type"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Batch AI Import Error:", error);
    return [];
  }
};

export const getFinancialAdvice = async (balances: JarBalance, stats: { debt: number, lent: number, net: number }, user: User | null): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const prefix = user?.gender === 'male' ? 'Anh' : user?.gender === 'female' ? 'Chị' : '';
    const name = user?.displayName || 'bạn';
    
    const prompt = `You are a personal finance expert using the 6-jar rule. 
    User: ${prefix} ${name}, Balances: ${JSON.stringify(balances)}. 
    Stats: Debt ${stats.debt}, Lent ${stats.lent}, Net Asset ${stats.net}.
    Provide a very short, motivating, and smart financial advice (max 25 words) in Vietnamese.
    Address the user as "${prefix} ${name}". Be concise and encouraging.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text || `Chào ${prefix} ${name}, hãy duy trì kỷ luật chi tiêu để sớm đạt tự do tài chính!`;
  } catch (error) {
    return "Hãy tiếp tục duy trì thói quen ghi chép tài chính mỗi ngày nhé!";
  }
};

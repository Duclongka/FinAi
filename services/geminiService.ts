
import { GoogleGenAI, Type } from "@google/genai";
import { JarType, AIAnalysisResult, Transaction, JarBalance, Loan } from "../types";

export const analyzeTransactionText = async (
  text: string, 
  recentTransactions: Transaction[]
): Promise<AIAnalysisResult | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const context = recentTransactions.slice(0, 10).map(t => 
      `ID: ${t.id}, Nội dung: "${t.description}", Số tiền: ${t.amount}, Loại: ${t.type}, Lọ: ${t.jarType || 'Tất cả'}`
    ).join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Yêu cầu từ người dùng: "${text}"\n\nDanh sách giao dịch gần đây:\n${context}`,
      config: {
        systemInstruction: `Bạn là một chuyên gia quản lý tài chính. Nhiệm vụ của bạn là phân tích yêu cầu người dùng và trả về JSON.
        
        Các loại hành động (action):
        1. "create": Tạo giao dịch mới.
        2. "update": Nhận diện yêu cầu sửa (ví dụ: "Sửa...", "Đổi...").
        3. "delete": Xóa một giao dịch (ví dụ: "Xóa giao dịch cuối").

        Quy tắc trả về JSON:
        - action: "create" | "update" | "delete"
        - targetId: ID của giao dịch cần sửa/xóa.
        - amount: Số tiền giao dịch.
        - jarType: NEC, LTS, EDU, PLAY, FFA, GIVE.
        - description: Mô tả ngắn gọn.
        - isExpense: true nếu là chi tiêu, false nếu là thu nhập.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["create", "update", "delete"] },
            targetId: { type: Type.STRING },
            amount: { type: Type.INTEGER },
            jarType: { type: Type.STRING, enum: Object.values(JarType) },
            description: { type: Type.STRING },
            isExpense: { type: Type.BOOLEAN },
          },
          required: ["action"],
        },
      },
    });

    const jsonStr = response.text?.trim() || "null";
    return JSON.parse(jsonStr) as AIAnalysisResult;
  } catch (error) {
    console.error("Error analyzing transaction:", error);
    return null;
  }
};

export const getFinancialAdvice = async (
  balances: JarBalance, 
  lastActionSummary: string
): Promise<string> => {
  try {
    const balanceInfo = Object.entries(balances)
      .map(([type, amt]) => `${type}: ${amt.toLocaleString()} VND`)
      .join(", ");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Số dư các hũ hiện tại: ${balanceInfo}. Hành động vừa thực hiện: "${lastActionSummary}".`,
      config: {
        systemInstruction: `Bạn là chuyên gia tài chính theo quy tắc 6 chiếc lọ. 
        NHIỆM VỤ: Đưa ra lời khuyên tài chính cực kỳ NGẮN GỌN (1-2 câu).
        1. KHÔNG liệt kê chi tiết số tiền.
        2. Nhận xét về kỷ luật tài chính dựa trên số dư các hũ.`,
      },
    });

    return response.text || "Đã cập nhật dữ liệu của bạn.";
  } catch (error) {
    console.error("Error getting advice:", error);
    return "Dữ liệu đã được cập nhật.";
  }
};

export const getDeepFinancialAnalysis = async (
  balances: JarBalance,
  transactions: Transaction[],
  loans: Loan[],
  userName: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const balanceInfo = Object.entries(balances)
      .map(([type, amt]) => `- Hũ ${type}: ${amt.toLocaleString()}đ`)
      .join("\n");
      
    const recentHistory = transactions.slice(0, 20).map(t => 
      `${t.type === 'income' ? 'Thu' : 'Chi'} ${t.amount.toLocaleString()}đ cho "${t.description}" (${t.jarType || 'Phân bổ'})`
    ).join("\n");

    const loanInfo = loans.length > 0 ? loans.map(l => 
      `- Nợ ${l.lenderName}: ${l.principal.toLocaleString()}đ (Còn lại ${(l.principal - l.paidAmount).toLocaleString()}đ)`
    ).join("\n") : "Không có nợ.";

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Thông tin tài chính của ${userName}:\n\nSỐ DƯ CÁC HŨ:\n${balanceInfo}\n\nKHOẢN NỢ:\n${loanInfo}\n\nLỊCH SỬ GIAO DỊCH GẦN ĐÂY:\n${recentHistory}`,
      config: {
        systemInstruction: `Bạn là Chuyên gia Tài chính Cao cấp. Hãy thực hiện một bản phân tích sức khỏe tài chính chi tiết theo quy tắc 6 chiếc lọ.
        
        CẤU TRÚC BÁO CÁO (Markdown):
        1. **Đánh giá tổng quát**: Nhận xét về tổng tài sản ròng và kỷ luật chi tiêu.
        2. **Phân tích từng hũ**: Hũ nào đang quá cao hoặc quá thấp? Người dùng có đang bỏ bê hũ EDU (Giáo dục) hay FFA (Tự do tài chính) không?
        3. **Chiến lược quản lý nợ**: Nếu có nợ, hãy đưa ra lộ trình trả nợ tối ưu dựa trên số dư hiện có.
        4. **Lời khuyên hành động (Top 3)**: 3 việc cụ thể cần làm ngay trong tuần này để cải thiện tình hình.
        
        PHONG CÁCH: Chuyên nghiệp, khích lệ nhưng thẳng thắn. Sử dụng các emoji phù hợp.`,
      },
    });

    return response.text || "Xin lỗi, tôi không thể thực hiện phân tích ngay bây giờ.";
  } catch (error) {
    console.error("Deep analysis error:", error);
    return "Đã xảy ra lỗi khi kết nối với Chuyên gia AI.";
  }
};

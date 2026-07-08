export async function generateSuggestion(apiKey, promptData) {
  if (!apiKey) {
    throw new Error('API Key is missing');
  }

  const { type, question, layer, drillTitle, drillIntro, hint } = promptData;
  let prompt = '';

  const contextStr = (drillTitle || drillIntro) ? `\nNgữ cảnh bài tập (Drill): ${drillTitle || ''} - ${drillIntro || ''}` : '';

  if (type === 'expand') {
    prompt = `Bạn là một giáo viên dạy IELTS xuất sắc. Người dùng đang làm bài tập với nội dung sau:${contextStr}
Câu cần xử lý / Câu hỏi: "${question}"
${hint ? `Gợi ý (Hint): ${hint}\n` : ''}
Hãy đóng vai một thí sinh IELTS Band 8.0+ và viết ra câu trả lời mẫu.
Yêu cầu QUAN TRỌNG:
- KHÔNG CHỈ viết lại (paraphrase) câu gốc một cách máy móc và cụt lủn.
- HÃY MỞ RỘNG (expand) thêm một vài chi tiết nhỏ để câu nói có hồn, tự nhiên và giống văn nói (conversational) hơn. (Ví dụ: thay vì chỉ nói "It was my first year", hãy thêm phần râu ria tự nhiên như "It was back in my freshman year, a time when I was still trying to figure things out...").
- Sử dụng các từ nối, fillers, hoặc idioms tự nhiên của người bản xứ.
- Nếu có Gợi ý (Hint), bắt buộc bám sát gợi ý đó làm cấu trúc chính.
- Độ dài khoảng 1-3 câu.
- Không giải thích dòng vo, chỉ xuất kết quả mẫu.`;
  } else if (type === 'build') {
    prompt = `Bạn là một giáo viên dạy IELTS xuất sắc. Người dùng đang làm bài tập xây dựng luận điểm:${contextStr}
Chủ đề / Câu hỏi: "${question}"
Người dùng cần gợi ý riêng cho phần: "${layer}".
Hãy cung cấp 1-2 câu tiếng Anh ngắn gọn, tự nhiên để đáp ứng phần "${layer}" này.
Yêu cầu:
- Chỉ tập trung vào phần "${layer}", không trả lời toàn bộ câu hỏi.
- Dùng từ vựng hoặc collocations tự nhiên.
- Không giải thích dòng vo, chỉ xuất kết quả mẫu.`;
  } else {
    prompt = `Bạn là chuyên gia IELTS. Trả lời ngắn gọn cho: ${question}`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Lỗi khi gọi API');
  }

  const data = await response.json();
  if (data.candidates && data.candidates.length > 0) {
    return data.candidates[0].content.parts[0].text;
  }
  
  throw new Error('Không nhận được phản hồi từ AI');
}

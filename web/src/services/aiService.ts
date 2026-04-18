const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export type ChatAnalysis = {
  summary: string
  riskLevel: 'Low' | 'Medium' | 'High'
  redFlags: string[]
  actionableInsights: {
    location?: string
    meetingTime?: string
    rewardDiscussed?: string
    contactInfo?: string
  }
  recommendation: string
}

export type Message = {
  sender_role: string
  content: string
  sent_at: string
}

async function groqCall(systemPrompt: string, userContent: string, json = false) {
  if (!GROQ_API_KEY) throw new Error('Groq API Key is missing.')
  const body: Record<string, unknown> = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.1,
  }
  if (json) body.response_format = { type: 'json_object' }
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq API error: ${err}`)
  }
  const data = await response.json()
  return data.choices[0].message.content as string
}

export async function analyzeChat(messages: Message[]): Promise<ChatAnalysis> {
  const conversation = messages.map(m => `${m.sender_role.toUpperCase()}: ${m.content}`).join('\n')
  const systemPrompt = `You are an expert Police Intelligence Analyzer for the LOQIT (Secure Phone Ownership & Recovery System) app.
Analyze the chat between a device OWNER and a FINDER.
IMPORTANT: Respond ONLY in the following JSON format:
{
  "summary": "Brief summary of the chat",
  "riskLevel": "Low | Medium | High",
  "redFlags": ["Flag 1", "Flag 2"],
  "actionableInsights": {
    "location": "Extracted location if any",
    "meetingTime": "Extracted time if any",
    "rewardDiscussed": "Reward details if any",
    "contactInfo": "Any shared phone/email"
  },
  "recommendation": "Advice for the officer"
}`
  const raw = await groqCall(systemPrompt, `Analyze this conversation:\n\n${conversation}`, true)
  return JSON.parse(raw) as ChatAnalysis
}

/* ── Auto-translate a message ── */
export async function translateMessage(text: string, targetLanguage = 'English'): Promise<string> {
  const systemPrompt = `You are a professional translator. Translate the given text to ${targetLanguage}.
Rules:
- Output ONLY the translated text, nothing else
- Preserve the tone and meaning exactly
- If the text is already in ${targetLanguage}, return it unchanged`
  return groqCall(systemPrompt, text)
}

/* ── Detect language of a message ── */
export async function detectLanguage(text: string): Promise<string> {
  const systemPrompt = `Detect the language of the given text. Output ONLY the language name (e.g. "Hindi", "Tamil", "English"). Nothing else.`
  return groqCall(systemPrompt, text)
}

/* ── Generate case summary for PDF export ── */
export async function generateCaseSummary(reportDetails: string): Promise<string> {
  const systemPrompt = `You are a police report writer. Given case details, write a professional, formal police case summary suitable for court submission. Include:
- Case Overview
- Incident Details
- Current Investigation Status
- Recommended Next Steps
Use formal police report language.`
  return groqCall(systemPrompt, reportDetails)
}

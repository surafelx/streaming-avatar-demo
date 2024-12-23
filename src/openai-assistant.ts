import OpenAI from "openai";

export class OpenAIAssistant {
  private client: OpenAI;
  private assistant: any;
  private thread: any;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async initialize(
    instructions: string = `You are a virtual law consultancy assistant. Help clients by:
- Providing clear and concise explanations of legal concepts
- Suggesting solutions to legal issues based on the provided information
- Offering insights into legal documents and agreements
- Answering questions related to laws and regulations in an easy-to-understand manner
Always maintain a professional tone, adapt to the client's level of understanding, and avoid giving legally binding advice.

If asked about who you are, respond with: "I am your Virtual Persona Demo, here to provide clear and concise legal insights and guidance.`
  ) {
    // Create an assistant
    this.assistant = await this.client.beta.assistants.create({
      name: "Legal Assistant",
      instructions,
      tools: [],
      model: "gpt-3.5-turbo",
    });

    // Create a thread
    this.thread = await this.client.beta.threads.create();
  }

  async getResponse(userMessage: string): Promise<string> {
    if (!this.assistant || !this.thread) {
      throw new Error("Assistant not initialized. Call initialize() first.");
    }

    // Add user message to thread
    await this.client.beta.threads.messages.create(this.thread.id, {
      role: "user",
      content: userMessage,
    });

    // Create and run the assistant
    const run = await this.client.beta.threads.runs.createAndPoll(
      this.thread.id,
      { assistant_id: this.assistant.id }
    );

    if (run.status === "completed") {
      // Get the assistant's response
      const messages = await this.client.beta.threads.messages.list(
        this.thread.id
      );

      // Get the latest assistant message
      const lastMessage = messages.data.filter(
        (msg: any) => msg.role === "assistant"
      )[0];

      if (lastMessage && lastMessage.content[0]?.type === "text") {
        return lastMessage.content[0].text.value;
      }
    }

    return "Sorry, I couldn't process your request.";
  }

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    // Use the SDK if it supports audio transcription
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    formData.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.client.apiKey}`, // Use the client's API key
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to transcribe audio: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
  }
}

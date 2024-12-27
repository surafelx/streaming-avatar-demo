import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";
import { OpenAIAssistant } from "./openai-assistant";

let openaiAssistant = null;

// Audio recording and analysis variables
let mediaRecorder = null;
const audioChunks = [];

// DOM elements
const videoElement = document.getElementById("avatarVideo");
const startButton = document.getElementById("startSession");
const endButton = document.getElementById("endSession");
const speakButton = document.getElementById("speakButton");
const userSpeakButton = document.getElementById("userSpeakButton");
const bookAppointmentButton = document.getElementById("bookAppointmentButton");
const userInput = document.getElementById("userInput");
const languageSelect = document.getElementById("languageSelect");

let avatar = null;
let sessionData = null;

// Helper function to fetch access token
async function fetchAccessToken() {
  const apiKey = import.meta.env.VITE_HEYGEN_API_KEY;
  const response = await fetch(
    "https://api.heygen.com/v1/streaming.create_token",
    {
      method: "POST",
      headers: { "x-api-key": apiKey },
    }
  );

  const { data } = await response.json();
  return data.token;
}

// Initialize streaming avatar session
async function initializeAvatarSession() {
  startButton.disabled = true;

  try {
    const token = await fetchAccessToken();
    avatar = new StreamingAvatar({ token });

    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    openaiAssistant = new OpenAIAssistant(openaiApiKey);
    await openaiAssistant.initialize();

    const selectedLanguage = languageSelect.value;
    sessionData = await avatar.createStartAvatar({
      quality: AvatarQuality.Medium,
      avatarName: "Dexter_Lawyer_Sitting_public",
      language: selectedLanguage,
    });

    console.log("Session data:", sessionData);
    endButton.disabled = false;
    userSpeakButton.disabled = false;

    avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
    avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);
  } catch (error) {
    console.error("Failed to initialize avatar session:", error);
    startButton.disabled = false;
  }
}

// Handle when avatar stream is ready
function handleStreamReady(event) {
  if (event.detail && videoElement) {
    videoElement.srcObject = event.detail;
    videoElement.onloadedmetadata = () => {
      videoElement.play().catch(console.error);
    };
  } else {
    console.error("Stream is not available");
  }
}

// Handle stream disconnection
function handleStreamDisconnected() {
  console.log("Stream disconnected");
  videoElement.srcObject = null;
  startButton.disabled = false;
  endButton.disabled = true;
}

// End the avatar session
async function terminateAvatarSession() {
  if (!avatar || !sessionData) return;

  await avatar.stopAvatar();
  videoElement.srcObject = null;
  avatar = null;
}

// Handle speaking event
async function handleSpeak() {
  if (avatar && openaiAssistant && userInput.value) {
    try {
      const response = await openaiAssistant.getResponse(userInput.value);

      // Check if user requested an appointment
      if (userInput.value.toLowerCase().includes("appointment")) {
        openCalendlyWidget();
        return;
      }

      await avatar.speak({
        text: response,
        taskType: TaskType.REPEAT,
      });
    } catch (error) {
      console.error("Error getting response:", error);
    }
    userInput.value = "";
  }
}

// Open Calendly widget for booking
function openCalendlyWidget() {
  Calendly.initPopupWidget({
    url: "https://calendly.com/farhansidiqui/30min",
  });
}

// Event listeners
startButton.addEventListener("click", initializeAvatarSession);
endButton.addEventListener("click", terminateAvatarSession);
speakButton.addEventListener("click", handleSpeak);
bookAppointmentButton.addEventListener("click", openCalendlyWidget);

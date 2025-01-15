import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
} from "@heygen/streaming-avatar";
import { OpenAIAssistant } from "./openai-assistant";

declare global {
  var Calendly: any;
}

let openaiAssistant: OpenAIAssistant | null = null;

// Audio recording and analysis variables
let mediaRecorder: MediaRecorder | null = null;
const audioChunks: Blob[] = [];

// DOM elements
const videoElement = document.getElementById("avatarVideo") as HTMLVideoElement;
const startButton = document.getElementById(
  "startSession"
) as HTMLButtonElement;
const endButton = document.getElementById("endSession") as HTMLButtonElement;
const speakButton = document.getElementById("speakButton") as HTMLButtonElement;
const userSpeakButton = document.getElementById(
  "userSpeakButton"
) as HTMLButtonElement;
const userInput = document.getElementById("userInput") as HTMLInputElement;
const languageSelect = document.getElementById(
  "languageSelect"
) as HTMLSelectElement;

let avatar: StreamingAvatar | null = null;
let sessionData: any = null;

// Helper function to fetch access token
async function fetchAccessToken(): Promise<string> {
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
  console.log("Hello from Heygen!");
  // Disable start button immediately to prevent double clicks
  startButton.disabled = true;

  try {
    const token = await fetchAccessToken();
    avatar = new StreamingAvatar({ token });

    // Initialize OpenAI Assistant
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    openaiAssistant = new OpenAIAssistant(openaiApiKey);
    await openaiAssistant.initialize();

    const selectedLanguage = languageSelect.value; // Get selected language from dropdown
    sessionData = await avatar.createStartAvatar({
      quality: AvatarQuality.Medium,
      avatarName: "Dexter_Lawyer_Sitting_public",
      language: selectedLanguage,
    });

    console.log("Session data:", sessionData);

    // Enable end button
    endButton.disabled = false;
    userSpeakButton.disabled = false;

    avatar.on(StreamingEvents.STREAM_READY, handleStreamReady);
    avatar.on(StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected);
  } catch (error) {
    console.error("Failed to initialize avatar session:", error);
    // Re-enable start button if initialization fails
    startButton.disabled = false;
  }
}

// Handle when avatar stream is ready
function handleStreamReady(event: any) {
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
  if (videoElement) {
    videoElement.srcObject = null;
  }

  // Enable start button and disable end button
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
      const userQuery = userInput.value.toLowerCase(); // Get and normalize user input

      // Check for keywords related to appointments
      const appointmentKeywords = [
        "appointment",
        "schedule",
        "meeting",
        "book",
      ];
      const isAppointmentRequest = appointmentKeywords.some((keyword) =>
        userQuery.includes(keyword)
      );

      if (isAppointmentRequest) {
        // Open Google Calendar link in a new tab
        console.log("Appointment request detected. Opening Google Calendar...");
        window.open("https://calendar.google.com/", "_blank");
        return; // Skip OpenAI processing for this specific request
      }

      const response = await openaiAssistant.getResponse(userInput.value);
      await avatar.speak({
        text: response,
        taskType: TaskType.REPEAT,
      });
    } catch (error) {
      console.error("Error getting response:", error);
    }
    userInput.value = ""; // Clear input after speaking
  }
}

async function handleStartSpeaking() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new window.AudioContext();
    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    mediaStreamSource.connect(analyser);

    let silenceStart: number | null = null;
    const silenceTimeout = 2000;
    let silenceDetected = false;

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      audioChunks.length = 0;
      transcribeAudio(audioBlob);
    };

    mediaRecorder.start();

    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      const avgVolume = dataArray.reduce((a, b) => a + b) / bufferLength;
      const silenceThreshold = 20;

      if (avgVolume < silenceThreshold) {
        if (!silenceStart) silenceStart = Date.now();

        if (Date.now() - silenceStart >= silenceTimeout && !silenceDetected) {
          silenceDetected = true;
          handleStopSpeaking();
          audioContext.close();
          stream.getTracks().forEach((track) => track.stop());
        }
      } else {
        silenceStart = null;
      }

      if (!silenceDetected) requestAnimationFrame(checkSilence);
    };

    checkSilence();
  } catch (error) {
    console.error("Error accessing microphone:", error);
  }
}

async function handleStopSpeaking() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
  }
}

// Transcribe audio and generate response
async function transcribeAudio(audioBlob: Blob) {
  try {
    const audioFile = new File([audioBlob], "recording.wav", {
      type: "audio/wav",
    });
    const response = await openaiAssistant!.transcribeAudio(audioFile);
    const transcription = response;

    // Check for keywords related to appointments
    const appointmentKeywords = ["appointment", "schedule", "meeting", "book"];
    const isAppointmentRequest = appointmentKeywords.some((keyword) =>
      transcription.toLowerCase().includes(keyword)
    );

    if (isAppointmentRequest) {
      // Open Google Calendar link in a new tab
      console.log("Appointment request detected. Opening Google Calendar...");
      window.open("https://calendar.google.com/", "_blank");
      return; // Skip AI response for this specific request
    }

    const aiResponse = await openaiAssistant!.getResponse(transcription);
    await avatar!.speak({ text: aiResponse, taskType: TaskType.REPEAT });
  } catch (error) {
    console.error("Error transcribing audio:", error);
  }
}

// Event listeners for buttons
startButton.addEventListener("click", initializeAvatarSession);
endButton.addEventListener("click", terminateAvatarSession);
speakButton.addEventListener("click", handleSpeak);
userSpeakButton.addEventListener("click", handleStartSpeaking);

// Add language options to the dropdown dynamically
const languages = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Chinese",
  "Japanese",
  "Russian",
  "Arabic",
  "Hindi",
  "Korean",
  "Dutch",
  "Turkish",
  "Swedish",
  "Norwegian",
  "Polish",
  "Czech",
  "Greek",
  "Hungarian",
];

languages.forEach((language) => {
  const option = document.createElement("option");
  option.value = language;
  option.textContent = language;
  languageSelect.appendChild(option);
});

// Listen for language selection changes
languageSelect.addEventListener("change", async () => {
  try {
    // Disable buttons during session restart
    startButton.disabled = true;
    endButton.disabled = true;
    userSpeakButton.disabled = true;

    console.log("Language changed to:", languageSelect.value);

    // Terminate current session
    if (avatar && sessionData) {
      console.log("Terminating current session...");
      await terminateAvatarSession();
    }

    // Reinitialize session with the new language
    console.log("Reinitializing session with new language...");
    await initializeAvatarSession();

    console.log(
      "Session restarted successfully with language:",
      languageSelect.value
    );
  } catch (error) {
    console.error("Error restarting session:", error);
    startButton.disabled = false; // Re-enable start button in case of error
  }
});

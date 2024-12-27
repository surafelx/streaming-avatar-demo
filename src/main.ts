// Define types for variables
let openaiAssistant: any; // Replace `any` with the correct type if available
let avatar: any;         // Replace `any` with the correct type
let sessionData: any;    // Replace `any` with the correct type

// Safely get DOM elements with type assertions
const startButton = document.getElementById('startButton') as HTMLButtonElement | null;
const endButton = document.getElementById('endButton') as HTMLButtonElement | null;
const userSpeakButton = document.getElementById('userSpeakButton') as HTMLButtonElement | null;
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement | null;
const userInput = document.getElementById('userInput') as HTMLInputElement | null;
const videoElement = document.getElementById('videoElement') as HTMLVideoElement | null;
const bookAppointmentButton = document.getElementById('bookAppointmentButton') as HTMLButtonElement | null;

// Event listener for start button
startButton?.addEventListener('click', () => {
  startButton.disabled = true;
  endButton?.disabled = false;
});

// Event listener for end button
endButton?.addEventListener('click', () => {
  endButton.disabled = true;
  startButton?.disabled = false;
});

// Handle user speaking button
userSpeakButton?.addEventListener('click', async () => {
  if (userInput) {
    const userMessage = userInput.value;
    userInput.value = '';

    // Process user message with openaiAssistant (example implementation)
    const response = await openaiAssistant?.generateResponse(userMessage);
    console.log('AI Response:', response);
  }
});

// Handle language selection
languageSelect?.addEventListener('change', (event) => {
  const selectedLanguage = (event.target as HTMLSelectElement).value;
  console.log('Selected Language:', selectedLanguage);
});

// Initialize video stream
async function startVideoStream() {
  if (!videoElement) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    await videoElement.play();
  } catch (error) {
    console.error('Error accessing video stream:', error);
  }
}

// Stop video stream
function stopVideoStream() {
  if (!videoElement || !videoElement.srcObject) return;

  const stream = videoElement.srcObject as MediaStream;
  const tracks = stream.getTracks();
  tracks.forEach((track) => track.stop());
  videoElement.srcObject = null;
}

// Start and end video stream handlers
startButton?.addEventListener('click', startVideoStream);
endButton?.addEventListener('click', stopVideoStream);

// Calendly booking button
if (bookAppointmentButton) {
  declare const Calendly: any; // Replace with the correct type if available

  bookAppointmentButton.addEventListener('click', () => {
    Calendly.showPopupWidget('https://calendly.com/example');
  });
}

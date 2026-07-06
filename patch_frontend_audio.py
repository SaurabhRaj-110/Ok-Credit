import re

with open('frontend/js/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Replace toggleListening function entirely
old_toggle_regex = re.compile(r'function toggleListening\(\) \{[\s\S]*?\}\s*let voiceEntryContext = \'HOME\';')

new_toggle = """
        let mediaRecorder = null;
        let audioChunks = [];
        let audioContext = null;
        let analyser = null;
        let silenceTimer = null;

        async function toggleListening() {
            if (isMicListening) {
                stopRecording();
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const checkSilence = () => {
                    if (!isMicListening) return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
                    let average = sum / bufferLength;

                    if (average < 10) { // Silence threshold
                        if (!silenceTimer) {
                            silenceTimer = setTimeout(() => {
                                console.log("Silence detected, stopping recording");
                                stopRecording();
                            }, 2500); // 2.5 seconds of silence
                        }
                    } else {
                        if (silenceTimer) {
                            clearTimeout(silenceTimer);
                            silenceTimer = null;
                        }
                    }
                    if (isMicListening) requestAnimationFrame(checkSilence);
                };

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstart = () => {
                    isMicListening = true;
                    let ms = document.getElementById('mic-status');
                    if (ms) ms.innerText = "Suno... Munim sun raha hai...";
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.add('listening'));
                    document.getElementById('veStatusTitle').innerText = "Listening... Bolna start karein";
                    document.getElementById('veStatusTitle').style.color = "var(--primary)";
                    checkSilence();
                };

                mediaRecorder.onstop = async () => {
                    isMicListening = false;
                    document.querySelectorAll('.fab-mic, .vc-mic-btn, .txv-mic').forEach(e => e.classList.remove('listening'));
                    if (silenceTimer) {
                        clearTimeout(silenceTimer);
                        silenceTimer = null;
                    }
                    if (audioContext) {
                        audioContext.close();
                        audioContext = null;
                    }
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());

                    document.getElementById('veStatusTitle').innerText = "Processing Voice...";
                    
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await processAudioBlob(audioBlob);
                };

                mediaRecorder.start();

            } catch (err) {
                console.warn('Mic init error:', err);
                isMicListening = false;
                let manualInput = prompt("Voice Entry: Type your command (e.g. '2 kilo aata 100 ka'):");
                if (manualInput) {
                    processVoiceWithBackendAI(manualInput);
                }
            }
        }

        async function processAudioBlob(blob) {
            const formData = new FormData();
            formData.append("audio", blob, "voice.webm");
            
            try {
                const res = await fetch(`${RENDER_API_URL}/api/voice/transcribe`, {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "SUCCESS") {
                        let transcript = data.transcript;
                        document.getElementById('veTranscriptText').innerText = `"${transcript}"`;
                        processVoiceWithBackendAI(transcript);
                    }
                } else {
                    throw new Error("Transcription failed");
                }
            } catch (e) {
                console.error(e);
                showToast("Network Error: Could not process voice");
                document.getElementById('veStatusTitle').innerText = "Tap Mic to Speak";
            }
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                mediaRecorder.stop();
            }
        }

        let voiceEntryContext = 'HOME';
"""

if old_toggle_regex.search(js):
    js = old_toggle_regex.sub(new_toggle, js)
    with open('frontend/js/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Frontend audio logic injected successfully")
else:
    print("Could not find toggleListening to replace")

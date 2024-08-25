import React, { useEffect, useRef, useState } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from 'simli-client';

const simli_faceid = '88109f93-40ce-45b8-b310-1473677ddde2';
const BUFFER_SIZE = 6000;
const SAMPLE_RATE = 16000;

// Helper function to save audio data to a file
const saveAudioToFile = (audioData: Float32Array | Int16Array, sampleRate: number, filename: string) => {
  const wav = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(wav);

  // Write WAV header
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, audioData.length * 2, true);

  // Write audio data
  let index = 44;
  for (let i = 0; i < audioData.length; i++) {
    if (audioData instanceof Int16Array) {
      view.setInt16(index, audioData[i], true);
    } else {
      view.setInt16(index, audioData[i] * 0x7FFF, true);
    }
    index += 2;
  }

  const blob = new Blob([view], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};

const SimliIntegratedVoiceClientAudioWrapper: React.FC = () => {
  const botAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const simliAudioRef = useRef<HTMLAudioElement>(null);
  const botAudioTrack = useVoiceClientMediaTrack("audio", "bot");
  const [simliClient, setSimliClient] = useState<SimliClient | null>(null);
  const [isSimliInitialized, setIsSimliInitialized] = useState(false);

  useEffect(() => {
    if (videoRef.current && simliAudioRef.current && !isSimliInitialized) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: simli_faceid,
        handleSilence: true,
        videoRef: videoRef,
        audioRef: simliAudioRef,
      };

      const client = new SimliClient();
      client.Initialize(SimliConfig);
      setSimliClient(client);
      setIsSimliInitialized(true);
      console.log('Simli Client initialized');

      client.start();
    }

    return () => {
      if (simliClient) {
        simliClient.close();
      }
    };
  }, [isSimliInitialized]);

  useEffect(() => {
    if (!botAudioRef.current || !botAudioTrack || !simliClient) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const sourceNode = audioContext.createMediaStreamSource(new MediaStream([botAudioTrack]));

    let audioWorklet: AudioWorkletNode;
    let audioBuffer: Int16Array[] = [];

    const initializeAudioWorklet = async () => {
      await audioContext.audioWorklet.addModule(URL.createObjectURL(new Blob([`
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Int16Array(${BUFFER_SIZE});
            this.bufferIndex = 0;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const inputChannel = input[0];

            if (inputChannel) {
              for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = Math.max(-32768, Math.min(32767, Math.round(inputChannel[i] * 32767)));
                this.bufferIndex++;

                if (this.bufferIndex === this.buffer.length) {
                  this.port.postMessage({type: 'audioData', data: this.buffer});
                  this.bufferIndex = 0;
                }
              }
            }

            return true;
          }
        }

        registerProcessor('audio-processor', AudioProcessor);
      `], { type: 'application/javascript' })));

      audioWorklet = new AudioWorkletNode(audioContext, 'audio-processor');
      sourceNode.connect(audioWorklet);
      audioWorklet.connect(audioContext.destination);

      audioWorklet.port.onmessage = (event) => {
        if (event.data.type === 'audioData') {
          audioBuffer.push(new Int16Array(event.data.data));
          console.log('Audio data length:', event.data.data.length);
          console.log('Audio data sent at:', new Date().getTime());
          simliClient.sendAudioData(new Uint8Array(event.data.data.buffer));
        }
      };
    };

    initializeAudioWorklet();

    // Save audio data every 10 seconds
    const saveInterval = setInterval(() => {
      if (audioBuffer.length > 0) {
        const concatenatedAudio = new Int16Array(audioBuffer.reduce((acc, curr) => acc + curr.length, 0));
        let offset = 0;
        for (const buffer of audioBuffer) {
          concatenatedAudio.set(buffer, offset);
          offset += buffer.length;
        }
        saveAudioToFile(concatenatedAudio, SAMPLE_RATE, 'audio.wav');
        audioBuffer = [];
      }
    }, 10000);

    return () => {
      clearInterval(saveInterval);
      if (audioWorklet) {
        audioWorklet.disconnect();
      }
      sourceNode.disconnect();
      audioContext.close();
    };
  }, [botAudioTrack, simliClient]);

  return (
    <div className="relative w-full aspect-video">
      <video ref={videoRef} id="simli_video" autoPlay playsInline className="w-full h-full object-cover"></video>
      <audio ref={simliAudioRef} id="simli_audio" autoPlay></audio>
      <audio ref={botAudioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SimliIntegratedVoiceClientAudioWrapper;
import React, { useEffect, useRef, useState } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from 'simli-client';

const simli_faceid = '88109f93-40ce-45b8-b310-1473677ddde2';
const BUFFER_SIZE = 1024*16; // Adjust this value as needed
const SAMPLE_RATE = 48000; // Original sample rate
const TARGET_SAMPLE_RATE = 16000; // Target sample rate

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

      // setTimeout(() => {
      //   const audioData = new Uint8Array(6000).fill(0);
      //   client.sendAudioData(audioData);
      // }, 4000);
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

    const initializeAudioWorklet = async () => {
      await audioContext.audioWorklet.addModule(URL.createObjectURL(new Blob([`
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.inputSampleRate = ${SAMPLE_RATE};
            this.outputSampleRate = ${TARGET_SAMPLE_RATE};
            this.buffer = new Int16Array(${BUFFER_SIZE});
            this.bufferIndex = 0;
          }

          downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
            if (outputSampleRate === inputSampleRate) {
              return buffer;
            }
            const sampleRateRatio = inputSampleRate / outputSampleRate;
            const newLength = Math.round(buffer.length / sampleRateRatio);
            const result = new Int16Array(newLength);
            let offsetResult = 0;
            let offsetBuffer = 0;

            while (offsetResult < result.length) {
              const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
              let accum = 0, count = 0;
              for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
              }
              result[offsetResult] = Math.max(-32768, Math.min(32767, Math.floor(accum / count)));
              offsetResult++;
              offsetBuffer = nextOffsetBuffer;
            }
            return result;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const inputChannel = input[0];

            if (inputChannel) {
              for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = Math.max(-32768, Math.min(32767, Math.floor(inputChannel[i] * 32768)));
                this.bufferIndex++;

                if (this.bufferIndex === this.buffer.length) {
                  const downsampledBuffer = this.downsampleBuffer(this.buffer, this.inputSampleRate, this.outputSampleRate);
                  this.port.postMessage(downsampledBuffer);
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
        simliClient.sendAudioData(new Uint8Array(event.data.buffer));
      };
    };

    initializeAudioWorklet();

    return () => {
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

import React, { useEffect, useRef, useState } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from "simli-client";
import { config } from "./config"; // Import the config

const SimliIntegratedVoiceClientAudioWrapper: React.FC = () => {
  const botAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const simliAudioRef = useRef<HTMLAudioElement>(null);
  const botAudioTrack = useVoiceClientMediaTrack("audio", "bot");
  const [simliClient, setSimliClient] = useState<SimliClient | null>(null);

  useEffect(() => {
    if (videoRef.current && simliAudioRef.current) {
      const SimliConfig = {
        apiKey: process.env.NEXT_PUBLIC_SIMLI_API_KEY,
        faceID: config.faceId, // Use the faceId from config
        handleSilence: true,
        videoRef: videoRef,
        audioRef: simliAudioRef,
      };

      const client = new SimliClient();
      client.Initialize(SimliConfig);
      setSimliClient(client);

      client.start();
    }

    return () => {
      if (simliClient) {
        simliClient.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!botAudioRef.current || !botAudioTrack || !simliClient) return;

    const audioContext: AudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    const sourceNode = audioContext.createMediaStreamSource(
      new MediaStream([botAudioTrack])
    );

    let audioWorklet: AudioWorkletNode;
    let audioBuffer: Int16Array[] = [];

    const initializeAudioWorklet = async () => {
      await audioContext.audioWorklet.addModule(
        URL.createObjectURL(
          new Blob(
            [
              `
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Int16Array(${3000});
            this.bufferIndex = 0;
            this.prev = Date.now();
            this.first = true;
          }

          process(inputs, outputs, parameters) {
            const input = inputs[0];
            const inputChannel = input[0];
            console.log('Audio data received in processor at', Date.now() - this.prev);
            this.prev = Date.now();
            console.log(inputChannel.length);
            if (inputChannel) {
              for (let i = 0; i < inputChannel.length; i++) {
                this.buffer[this.bufferIndex] = Math.max(-32768, Math.min(32767, Math.round(inputChannel[i] * 32767)));
                this.bufferIndex++;
                
                if (this.bufferIndex === this.buffer.length || ((Date.now() - this.prev > ${
                  (3000 / 16000) * 1000
                }) && ! this.first)){
                  this.first = false;
                  this.prev = Date.now();
                  this.port.postMessage({type: 'audioData', data: this.buffer.slice(0, this.bufferIndex)});
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }

        registerProcessor('audio-processor', AudioProcessor);
      `,
            ],
            { type: "application/javascript" }
          )
        )
      );

      audioWorklet = new AudioWorkletNode(audioContext, "audio-processor");
      sourceNode.connect(audioWorklet);
      // audioWorklet.connect(audioContext.destination);
      let previous = performance.now();
      audioWorklet.port.onmessage = (event) => {
        if (event.data.type === "audioData") {
          console.log("Audio data received in port at", Date.now());
          audioBuffer.push(new Int16Array(event.data.data));
          console.log("Audio data length:", event.data.data.length);
          simliClient.sendAudioData(new Uint8Array(event.data.data.buffer));
          console.log("Audio data sent at:", performance.now() - previous);
          previous = performance.now();
        }
      };
    };

    initializeAudioWorklet();

    return () => {
      audioWorklet.disconnect();
      sourceNode.disconnect();
      audioContext.close();
    };
  }, [botAudioTrack, simliClient]);

  return (
    <div className="relative w-full aspect-video">
      <video
        ref={videoRef}
        id="simli_video"
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      ></video>
      <audio ref={simliAudioRef} id="simli_audio" autoPlay></audio>
      <audio ref={botAudioRef} style={{ display: "none" }} />
    </div>
  );
};

export default SimliIntegratedVoiceClientAudioWrapper;

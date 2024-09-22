import React, { useEffect, useRef, useState } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from "../SimliClient";
import { config } from "./config"; // Import the config

const SimliIntegratedVoiceClientAudioWrapper: React.FC = () => {
  const botAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const simliAudioRef = useRef<HTMLAudioElement>(null);
  const botAudioTrack = useVoiceClientMediaTrack("audio", "bot");
  const [simliClient, setSimliClient] = useState<SimliClient | null>(null);

  useEffect(() => {
    if (videoRef.current && simliAudioRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_SIMLI_API_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_SIMLI_API_KEY is not defined");
        return;
      }

      const SimliConfig = {
        apiKey,
        faceID: config.faceId, // Use the faceId from config
        handleSilence: false,
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

    simliClient.listenToMediastreamTrack(botAudioTrack)
  }, [botAudioTrack, simliClient]);

  return (
    <div className="relative w-full aspect-video">
      <video
        ref={videoRef}
        id="simli_video"
        autoPlay
        playsInline
        className="w-full h-full"
      ></video>
      <audio ref={simliAudioRef} id="simli_audio" autoPlay></audio>
      <audio ref={botAudioRef} style={{ display: "none" }} />
    </div>
  );
};

export default SimliIntegratedVoiceClientAudioWrapper;

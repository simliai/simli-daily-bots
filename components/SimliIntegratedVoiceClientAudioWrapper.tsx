import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { useVoiceClientMediaTrack } from "realtime-ai-react";
import { SimliClient } from "../SimliClient";
import { config } from "./config"; // Import the config

export interface SimliIntegratedVoiceClientAudioWrapperProps {
  listenToTrack: (botTrack: MediaStreamTrack) => void;
}

const SimliIntegratedVoiceClientAudioWrapper = forwardRef<SimliIntegratedVoiceClientAudioWrapperProps, {}>((props, ref) => {
  // const botAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const simliAudioRef = useRef<HTMLAudioElement>(null);
  const botAudioTrack = useVoiceClientMediaTrack("audio", "bot");
  // const [simliClient, setSimliClient] = useState<SimliClient | null>(null);
  const simliClient = useRef<SimliClient | null>(null);
  const isInitialized = useRef(false);


  useEffect(() => {
    if (isInitialized.current) {
      return;
    }
    if (videoRef.current && simliAudioRef.current) {
      isInitialized.current = true;
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
      simliClient.current = client;
      // setSimliClient(client);

      client.start();
    }

    return () => {
      if (simliClient.current) {
        console.log("CLOSINGGG")
        simliClient.current.close();
        isInitialized.current = false;
        simliClient.current = null;
      }
    };
  }, []);

  // useEffect(() => {
  //   console.log("botAudioTrack", botAudioTrack);
  //   if (!botAudioTrack || !simliClient) return;

  //   simliClient.current?.listenToMediastreamTrack(botAudioTrack)
  // }, [botAudioTrack]);

  const listenToTrack = (botTrack: MediaStreamTrack) => {
    simliClient.current?.listenToMediastreamTrack(botTrack)
  }
  useImperativeHandle(ref, () => ({
    listenToTrack,
  }));
  // useImperativeHandle()
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
      {/* <audio ref={botAudioRef} style={{ display: "none" }} /> */}
    </div>
  );
});

export default SimliIntegratedVoiceClientAudioWrapper;

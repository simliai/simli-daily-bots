import { EventEmitter } from "events";
import {AudioProcessor} from './AudioWorklet';
export interface SimliClientConfig {
  apiKey: string;
  faceID: string;
  handleSilence: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  audioRef: React.RefObject<HTMLAudioElement>;
}

export class SimliClient extends EventEmitter {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private dcInterval: NodeJS.Timeout | null = null;
  private candidateCount: number = 0;
  private prevCandidateCount: number = -1;
  private apiKey: string = "";
  private faceID: string = "";
  private handleSilence: boolean = true;
  private videoRef: React.RefObject<HTMLVideoElement> | null = null;
  private audioRef: React.RefObject<HTMLAudioElement> | null = null;
  private errorReason: string | null = null;
  private sessionInitialized: boolean = false;
  private inputStreamTrack : MediaStreamTrack | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private audioBuffer: Int16Array | null = null;
  constructor() {
    super();
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleBeforeUnload);
      window.addEventListener("pagehide", this.handlePageHide);
    }
  }

  public Initialize(config: SimliClientConfig) {
    this.apiKey = config.apiKey;
    this.faceID = config.faceID;
    this.handleSilence = config.handleSilence;
    if (typeof window !== "undefined") {
      this.videoRef = config.videoRef;
      this.audioRef = config.audioRef;
    } else {
      console.warn(
        "Running in Node.js environment. Some features may not be available."
      );
    }
  }

  private createPeerConnection() {
    const config: RTCConfiguration = {
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    };
    console.log("Server running: ", config.iceServers);

    this.pc = new window.RTCPeerConnection(config);

    if (this.pc) {
      this.setupPeerConnectionListeners();
    }
  }

  private setupPeerConnectionListeners() {
    if (!this.pc) return;

    this.pc.addEventListener("icegatheringstatechange", () => {
      console.log("ICE gathering state changed: ", this.pc?.iceGatheringState);
    });

    this.pc.addEventListener("iceconnectionstatechange", () => {
      console.log(
        "ICE connection state changed: ",
        this.pc?.iceConnectionState
      );
    });

    this.pc.addEventListener("signalingstatechange", () => {
      console.log("Signaling state changed: ", this.pc?.signalingState);
    });

    this.pc.addEventListener("track", (evt) => {
      console.log("Track event: ", evt.track.kind);
      if (evt.track.kind === "video" && this.videoRef?.current) {
        this.videoRef.current.srcObject = evt.streams[0];
      } else if (evt.track.kind === "audio" && this.audioRef?.current) {
        this.audioRef.current.srcObject = evt.streams[0];
      }
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        console.log(JSON.stringify(this.pc?.localDescription));
      } else {
        console.log(event.candidate);
        this.candidateCount += 1;
      }
    };
  }

  async start() {
    await this.createPeerConnection();

    const parameters = { ordered: true };
    this.dc = this.pc!.createDataChannel("chat", parameters);

    this.setupDataChannelListeners();
    this.pc?.addTransceiver("audio", { direction: "recvonly" });
    this.pc?.addTransceiver("video", { direction: "recvonly" });

    await this.negotiate();
  }

  private setupDataChannelListeners() {
    if (!this.dc) return;

    this.dc.addEventListener("close", () => {
      console.log("Data channel closed");
      this.emit("disconnected");
      this.stopDataChannelInterval();
    });

    this.dc.addEventListener("open", async () => {
      console.log("Data channel opened");
      this.emit("connected");
      await this.initializeSession();

      this.startDataChannelInterval();
    });

    this.dc.addEventListener("message", (evt) => {
      if (evt.data === "START") 
      {
       this.sessionInitialized = true; 
      }
      console.log("Received message: ", evt.data);
    });
  }

  private startDataChannelInterval() {
    this.stopDataChannelInterval(); // Clear any existing interval
    this.dcInterval = setInterval(() => {
      this.sendPingMessage();
    }, 1000);
  }

  private stopDataChannelInterval() {
    if (this.dcInterval) {
      clearInterval(this.dcInterval);
      this.dcInterval = null;
    }
  }

  private sendPingMessage() {
    if (this.dc && this.dc.readyState === "open") {
      const message = "ping " + Date.now();
      console.log("Sending: " + message);
      try {
        this.dc.send(message);
      } catch (error) {
        console.error("Failed to send message:", error);
        this.stopDataChannelInterval();
      }
    } else {
      console.warn(
        "Data channel is not open. Current state:",
        this.dc?.readyState
      );
      if (this.errorReason !== null) {
        console.error("Error Reason: ", this.errorReason);
      }
      this.stopDataChannelInterval();
    }
  }

  private async initializeSession() {
    const metadata = {
      faceId: this.faceID,
      isJPG: false,
      apiKey: this.apiKey,
      syncAudio: true,
      handleSilence: this.handleSilence,
    };

    try {
      const response = await fetch(
        "https://api.simli.ai/startAudioToVideoSession",
        {
          method: "POST",
          body: JSON.stringify(metadata),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const resJSON = await response.json();
      if (this.dc && this.dc.readyState === "open") {
        this.dc.send(resJSON.session_token);
      } else {
        this.emit("failed");
        this.errorReason = "Session Init failed: Simli API returned Code:" + response.status + "\n" + JSON.stringify(resJSON);
        console.error(
          "Data channel not open when trying to send session token " + this.errorReason 
        );
        await this.pc?.close();
      }
    } catch (error) {
      this.emit("failed");
      this.errorReason = "Session Init failed: :" + error;
      console.error("Failed to initialize session:", error);
      await this.pc?.close();
      
    }
  }

  private async negotiate() {
    if (!this.pc) {
      throw new Error("PeerConnection not initialized");
    }

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      await this.waitForIceGathering();

      const localDescription = this.pc.localDescription;
      if (!localDescription) return;

      const response = await fetch("https://api.simli.ai/StartWebRTCSession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sdp: localDescription.sdp,
          type: localDescription.type,
          video_transform: "none",
        }),
      });
      if (response.status !== 200) {
        this.emit("failed");
        const text = await response.text();
        this.errorReason = "Negotiation failed: Simli API returned Code:" + response.status + "\n" + text;
        console.error("Failed to negotiate:", response.status, text);
        this.pc?.close();
        return;
      }
      const answer = await response.json();

      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error("Negotiation failed:", e);
      this.errorReason = "Negotiation failed: " + e;
      this.emit("failed");
      this.pc.close();
    }
  }

  private async waitForIceGathering(): Promise<void> {
    if (!this.pc) return;

    if (this.pc.iceGatheringState === "complete") {
      return;
    }

    return new Promise<void>((resolve) => {
      const checkIceCandidates = () => {
        if (
          this.pc?.iceGatheringState === "complete" ||
          this.candidateCount === this.prevCandidateCount
        ) {
          console.log(this.pc?.iceGatheringState, this.candidateCount);
          resolve();
        } else {
          this.prevCandidateCount = this.candidateCount;
          setTimeout(checkIceCandidates, 250);
        }
      };

      checkIceCandidates();
    });
  }

  
  listenToMediastreamTrack(stream: MediaStreamTrack) {
    this.inputStreamTrack = stream;
    const audioContext: AudioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: 16000,
    });
    this.initializeAudioWorklet(audioContext,stream);
      }

  private initializeAudioWorklet(audioContext: AudioContext, stream: MediaStreamTrack) {
    audioContext.audioWorklet.addModule(URL.createObjectURL(new Blob([AudioProcessor], { type: 'application/javascript' }))).then(
      () => {
        this.audioWorklet = new AudioWorkletNode(audioContext, 'audio-processor');
        this.sourceNode = audioContext.createMediaStreamSource(new MediaStream([stream]));
        if (this.audioWorklet===null){
          throw new Error("AudioWorklet not initialized");
        }
        this.sourceNode.connect(this.audioWorklet);
        this.audioWorklet.port.onmessage = (event) => {
          if (event.data.type === "audioData") {
            this.sendAudioData(new Uint8Array(event.data.data.buffer));
          } 
        }
    });

  }

  sendAudioData(audioData: Uint8Array) {

    if (this.dc && this.dc.readyState === "open") {
      try {
        if (this.sessionInitialized){
          this.dc.send(audioData);
        }
        else{
          console.log("Data channel open but session is being initialized. Ignoring audio data.");
        }
      } catch (error) {
        console.error("Failed to send audio data:", error);
      }
    } else {
      console.error(
        "Data channel is not open. Current state:",
        this.dc?.readyState,
        "Error Reason: ",
        this.errorReason
      );
    }
  }

  close() {
    this.emit("disconnected");
    this.stopDataChannelInterval();

    // close data channel
    if (this.dc) {
      this.dc.close();
    }

    // close transceivers
    if (this.pc?.getTransceivers) {
      this.pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });
    }

    // close local audio / video
    this.pc?.getSenders().forEach((sender) => {
      sender.track?.stop();
    });

    // close peer connection
    this.pc?.close();

    // Cleanup
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.handleBeforeUnload);
      window.removeEventListener("pagehide", this.handlePageHide);
    }
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    this.close();
    event.preventDefault();
    event.returnValue = "";
  };

  private handlePageHide = (event: PageTransitionEvent) => {
    if (event.persisted) {
      // The page is being cached for bfcache
      this.close();
    } else {
      // The page is being unloaded
      this.close();
    }
  };
}

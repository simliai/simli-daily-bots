

const BUFFER_SIZE = 6000;

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

registerProcessor('audio-processor', AudioProcessor)